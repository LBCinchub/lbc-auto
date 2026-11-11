// "Which parts do I need" turn. Deterministic routing before the planner, so it can never become an
// estimate, order or any write. Typical parts come from general knowledge and are always labelled
// "Typical Parts, Fitment Not Verified"; the only shop data read is this shop's own parts inventory
// (name match only, never fitment). No part numbers, brands, stock promises or supplier prices.
import { roleAllows, enforceStaffDisclosure } from './policy.ts';
import { CAPABILITIES } from './registry.ts';
import { parseVehicle, parseJob, missingQuestions, stripInstructions, title, VIN_RE } from './laborTime.ts';
import { laborThread, contextVehicle } from './laborTurn.ts';
import { withDeadline } from './deadline.ts';

export const PARTS_ASK = 'To List The Parts';
export const PARTS_LOOKUP_PATH = '/PartsLookup';
const TYPICAL_MS = 15000;
const PARTS_RE = /\b(what|which)\s+parts\b|\bparts?\s+(needed|required|list|do\s+i\s+need|for)\b|\bneed(ed)?\s+parts\b|\bparts\s+needed\b/i;
const NOT_PARTS = /\b(inventory|in\s+stock|stock|low\s+stock|price\s*lib(rary)?|ordered|on\s+order|reorder)\b/i; // shop-record reads stay with the planner
const ENGINE_JOB = /\b(spark|plugs?|coil|water\s*pump|timing|belt|chain|thermostat|gasket|oil|filter|alternator|starter|injector|sensor|head|valve)\b/i;
const FOLLOW_UP_BLOCK = /\b(show|list\s+(my|our)|create|make|write|unpaid|invoices?|appointments?|customers?|estimates?|orders?|paid)\b/i;

export const partsIntent = (t: string) => PARTS_RE.test(String(t || '')) && !NOT_PARTS.test(String(t || ''));

export function routeParts(messages: any[]) {
  const latest = messages.filter((m) => m.role === 'user').at(-1)?.content || '';
  if (partsIntent(latest)) return true;
  const thread = laborThread(messages, PARTS_ASK);
  return thread.length > 1 && latest.split(/\s+/).length <= 14 && !FOLLOW_UP_BLOCK.test(latest);
}

const clean = (v: any, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
// Model output is advice text: drop anything that looks like a price or a specific part number.
const LOOKS_SPECIFIC = /\$|\b\d+(\.\d+)?\s*(usd|cad|dollars?)\b|\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9]{2,}-?[A-Z0-9]{3,}\b/;
export function sanitizeParts(list: any) {
  return (Array.isArray(list) ? list : []).map((p: any) => ({ name: clean(p?.name, 60), qty: clean(p?.qty, 20), note: clean(p?.note, 80) }))
    .filter((p) => p.name && !LOOKS_SPECIFIC.test(p.name) && !LOOKS_SPECIFIC.test(p.note)).slice(0, 8);
}

const PART = { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'string' }, note: { type: 'string' } } } };
export async function typicalParts(llm: any, vehicle: any, job: any) {
  try {
    const r: any = await withDeadline(llm({
      prompt: `List the typical parts and consumables an independent repair shop uses for this job. Vehicle: ${vehicle.label}. Job: ${job.label} ${job.sides.join(' ')}.
Rules: generic part names only (e.g. "Front Brake Pad Set"), never brands, part numbers, prices, stock or fitment claims. qty like "1 Set", "2", "1 Bottle", or "" if it varies. note: max 10 words, optional.
required = always needed for the stated repair; if_worn = inspect, replace only if worn or damaged; optional = nice to have. Return JSON {known, required, if_worn, optional}. If you do not know this job, return known false.`,
      response_json_schema: { type: 'object', properties: { known: { type: 'boolean' }, required: PART, if_worn: PART, optional: PART } },
    }), TYPICAL_MS);
    const out = { required: sanitizeParts(r?.required), if_worn: sanitizeParts(r?.if_worn), optional: sanitizeParts(r?.optional) };
    return r?.known === false || !out.required.length ? null : out;
  } catch (_) { return null; }
}

// This shop's own inventory, through the existing role-gated, tenant-scoped parts read.
async function inventoryMatches(ctx: any, names: string[]) {
  const cap = CAPABILITIES['parts.search'];
  if (!roleAllows(ctx.scope.role, cap)) return { status: 'forbidden_role', items: [] };
  const keys = [...new Set(names.map((n) => n.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !['front', 'rear', 'left', 'right', 'set', 'kit'].includes(w)).sort((a, b) => b.length - a.length)[0]).filter(Boolean))].slice(0, 3);
  if (!keys.length) return { status: 'no_results', items: [] };
  try {
    const pages = await Promise.all(keys.map((k) => cap.run(ctx, { query: k })));
    const seen = new Map();
    for (const p of pages) for (const x of enforceStaffDisclosure(ctx.scope.role, p).items || []) seen.set(x.id, x);
    const items = [...seen.values()].slice(0, 5);
    return { status: items.length ? 'ok' : 'no_results', items };
  } catch (e: any) { console.error('parts inventory failed', e?.name); return { status: 'unavailable', items: [] }; }
}

const lines = (list: any[]) => list.map((p) => `- ${title(p.name)}${p.qty ? ` - ${p.qty}` : ''}${p.note ? ` (${p.note})` : ''}`);

export async function partsTurn(ctx: any, llm: any, messages: any[]) {
  const text = stripInstructions(laborThread(messages, PARTS_ASK).join(' '));
  let vehicle = parseVehicle(text);
  let vehicleFrom = '';
  if (!vehicle.complete) {
    const cv = await contextVehicle(ctx);
    const parsed = cv && parseVehicle(cv.text);
    if (parsed?.complete) { vehicle = { ...parsed, used: vehicle.used }; vehicleFrom = cv!.from; }
  }
  const job = parseJob(text, vehicle.used);
  const questions = missingQuestions(vehicle, job);
  if (job.complete && vehicle.complete && ENGINE_JOB.test(job.label) && !vehicle.engine && !VIN_RE.test(text)) questions.push('Which Engine? (E.g. 2.0L Or V6) Or Give The VIN.');
  if (questions.length) return { reply: `${PARTS_ASK}, I Need:\n${questions.map((q) => `- ${q}`).join('\n')}`, staff: { tool_results: [{ label: 'Typical Parts', status: 'needs_input' }], read_only: true }, audit: [] };

  const typical = await typicalParts(llm, vehicle, job);
  const inv = typical ? await inventoryMatches(ctx, typical.required.map((p) => p.name)) : { status: 'skipped', items: [] as any[] };
  const side = job.sides.length ? ` (${title(job.sides.join(' '))})` : '';
  const out = [`**Parts Needed: ${job.label}${side} - ${vehicle.label}**`];
  if (vehicleFrom) out.push(`Vehicle From ${vehicleFrom}.`);
  if (!typical) out.push('Typical Parts Are Unavailable Right Now. Check Parts Lookup Or Your Supplier By VIN.');
  else {
    out.push('Typical Parts, Fitment Not Verified.', '', '**Required For This Repair**', ...lines(typical.required));
    if (typical.if_worn.length) out.push('', '**Inspect, Replace Only If Worn**', ...lines(typical.if_worn));
    if (typical.optional.length) out.push('', '**Optional**', ...lines(typical.optional));
    out.push('', '**In Your Inventory** (Name Match Only, Fitment Not Verified)');
    if (inv.status === 'ok') inv.items.forEach((p: any) => out.push(`- ${p.name}${p.part_number ? ` (${p.part_number})` : ''}${p.quantity != null ? ` - ${p.quantity} On Hand` : ''}`));
    else if (inv.status === 'no_results') out.push('No Matching Parts In Your Inventory.');
    else if (inv.status === 'forbidden_role') out.push('Inventory Is Not Available For Your Role.');
    else out.push('Your Inventory Could Not Be Checked Right Now.');
  }
  out.push('', '**Labor**', `Ask "Labor Time For ${job.label}${side}" To Check Your Shop History. No Licensed Labor Guide Is Connected.`);
  out.push('', '**Next Step**', 'Confirm Exact Parts And Fitment By VIN In Parts Lookup Or With Your Supplier.');
  const results: any[] = [{ label: 'Typical Parts (Not Verified)', status: typical ? 'ok' : 'unavailable' }];
  if (typical) results.push({ label: 'Parts Inventory', module: 'Parts', status: inv.status, count: inv.items.length });
  results.push({ label: 'Parts Fitment', status: 'not_connected' });
  return {
    reply: out.join('\n'),
    ...(typical ? {} : { retryable: true }),
    staff: { tool_results: results, links: [{ label: 'Parts Lookup', path: PARTS_LOOKUP_PATH }], options: [`Labor Time For ${job.label}${side} ${vehicle.label}`], read_only: true },
    audit: typical && inv.status !== 'forbidden_role' ? ['parts.search'] : [],
  };
}