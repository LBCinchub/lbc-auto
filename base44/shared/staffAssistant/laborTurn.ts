// Repair labor-time turn. Deterministic routing (the planner never sees it, so it can never become an
// estimate or any write). Shop history is billed time; book time needs a licensed guide (none is
// connected); optional rough guidance is labelled as such and never presented as book time.
import { getOwned } from './scope.ts';
import { roleAllows, FINANCE, OWNER } from './policy.ts';
import { laborIntent, mentionsRate, parseVehicle, parseJob, missingQuestions, title } from './laborTime.ts';
import { laborHistory, priceLibraryHits } from './laborHistory.ts';
import { withDeadline } from './deadline.ts';

export const LABOR_ASK = 'To Look Up Labor Time';
export const LABOR_GUIDE_CONNECTED = false; // no licensed labor-guide integration exists in this app
const ROUGH_MS = 15000;
const FOLLOW_UP_BLOCK = /\b(show|list|create|make|write|unpaid|invoices?|appointments?|customers?|estimates?|orders?|paid)\b/i;

// User messages of the current labor thread (continues only across LBC Auto AI's own labor questions).
export function laborThread(messages: any[]) {
  const out: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { out.unshift(messages[i].content); continue; }
    if (!String(messages[i].content).startsWith(LABOR_ASK)) break;
  }
  return out;
}

export function routeLabor(messages: any[]) {
  const latest = messages.filter((m) => m.role === 'user').at(-1)?.content || '';
  const intent = laborIntent(latest);
  if (intent) return intent;
  const thread = laborThread(messages);
  const followUp = thread.length > 1 && latest.split(/\s+/).length <= 14 && !FOLLOW_UP_BLOCK.test(latest);
  return followUp ? 'repair_hours' : null;
}

export function laborRateReply(scope: any) {
  if (!roleAllows(scope.role, { roles: OWNER })) return { reply: 'The Shop Labor Rate Is Not Available For Your Role.', staff: { tool_results: [{ label: 'Shop Settings', status: 'forbidden_role' }], read_only: true } };
  return { reply: scope.laborRate != null ? `Your Shop Labor Rate Is $${scope.laborRate}/Hr (From Settings). That Is Your Hourly Price, Not How Long A Job Takes.` : 'No Labor Rate Is Set Yet. Add It In Settings.',
    staff: { tool_results: [{ label: 'Shop Settings', module: 'Settings', status: 'ok' }], read_only: true } };
}

async function contextVehicle(ctx: any) {
  const h = ctx.page;
  if (!h || h.entity === 'Customer') return null;
  try {
    const rec = await getOwned(ctx.svc, h.entity, h.id, ctx.scope, h.entity);
    const text = h.entity === 'Vehicle' ? [rec.year, rec.make, rec.model, rec.engine_liters ? `${rec.engine_liters}L` : ''].filter(Boolean).join(' ') : rec.vehicle_info;
    return text ? { text: String(text).slice(0, 80), from: { Vehicle: 'This Vehicle', Estimate: 'This Estimate', RepairOrder: 'This Repair Order', Invoice: 'This Invoice' }[h.entity as string] } : null;
  } catch (_) { return null; } // another shop's or missing record: never used, never revealed
}

async function roughGuidance(llm: any, vehicle: any, job: any) {
  try {
    const r: any = await withDeadline(llm({
      prompt: `Give a rough typical labor time range in hours for an independent repair shop. Vehicle: ${vehicle.label}. Job: ${job.label} ${job.sides.join(' ')}. Not a licensed book time. Return JSON {low_hours, high_hours, note} where note is one short sentence (max 20 words) on what changes the time. If you do not know, return low_hours 0.`,
      response_json_schema: { type: 'object', properties: { low_hours: { type: 'number' }, high_hours: { type: 'number' }, note: { type: 'string' } } },
    }), ROUGH_MS);
    const lo = Number(r?.low_hours), hi = Number(r?.high_hours);
    if (!(lo > 0 && hi >= lo && hi <= 40)) return null;
    return { lo: Math.round(lo * 10) / 10, hi: Math.round(hi * 10) / 10, note: typeof r.note === 'string' ? r.note.replace(/\s+/g, ' ').trim().slice(0, 160) : '' };
  } catch (_) { return null; }
}

export async function laborTurn(ctx: any, llm: any, messages: any[]) {
  const text = laborThread(messages).join(' ');
  let vehicle = parseVehicle(text);
  let vehicleFrom = '';
  if (!vehicle.complete) {
    const cv = await contextVehicle(ctx);
    const parsed = cv && parseVehicle(cv.text);
    if (parsed?.complete) { vehicle = { ...parsed, used: vehicle.used }; vehicleFrom = cv!.from; }
  }
  const job = parseJob(text, vehicle.used);
  const questions = missingQuestions(vehicle, job);
  if (questions.length) return { reply: `${LABOR_ASK}, I Need:\n${questions.map((q) => `- ${q}`).join('\n')}`, staff: { tool_results: [{ label: 'Labor Time', status: 'needs_input' }], read_only: true }, audit: [] };

  const canHistory = roleAllows(ctx.scope.role, { roles: FINANCE });
  const [hist, priceHits, rough] = await Promise.all([
    canHistory ? laborHistory(ctx, vehicle, job).catch((e: any) => { console.error('labor history failed', e?.name); return { status: 'unavailable', items: [] } as any; }) : { status: 'forbidden_role', items: [] } as any,
    canHistory ? priceLibraryHits(ctx, job).catch(() => 0) : 0,
    roughGuidance(llm, vehicle, job),
  ]);
  const side = job.sides.length ? ` (${title(job.sides.join(' '))})` : '';
  const out = [`**Labor Time: ${job.label}${side} - ${vehicle.label}**`];
  if (vehicleFrom) out.push(`Vehicle From ${vehicleFrom}.`);
  out.push('', '**Your Shop History** (Time Billed Before, Not Book Time)');
  if (hist.status === 'forbidden_role') out.push('Shop History Is Not Available For Your Role.');
  else if (hist.status === 'unavailable') out.push('Your Shop History Could Not Be Checked Right Now.');
  else {
    if (hist.items.length) hist.items.forEach((x: any) => out.push(`- ${x.kind === 'exact' ? 'Exact Match' : 'Comparable Job'}: ${x.hours} h - ${x.source} ${x.number}, ${x.date} (${x.vehicle || 'Vehicle Not Saved'}; "${x.line}")`));
    else out.push('No Matching Labor Lines With Saved Hours Were Found.');
    if (hist.lines_without_hours) out.push(`${hist.lines_without_hours} Matching Line(s) Had No Saved Hours (Flat Price Or Unverified Rate), So No Hours Are Shown For Them.`);
    if (priceHits) out.push('Your Price Library Has A Price For This Item, But It Stores No Hours.');
    out.push(`Checked The Newest ${hist.records_checked} Estimates, Repair Orders And Invoices${hist.partial ? '; Older Records Were Not Searched' : ''}.`);
  }
  out.push('', '**Book Time**', "No Licensed Labor Guide Is Connected To LBC Auto, So I Can't Give A Verified Book Time.");
  out.push('', '**Rough Guidance (Not Book Time)**', rough ? `About ${rough.lo}-${rough.hi} h.${rough.note ? ` ${rough.note}` : ''} Verify With A Labor Guide Before Quoting.` : 'Rough Guidance Is Unavailable Right Now.');
  if (mentionsRate(text) && ctx.scope.laborRate != null && roleAllows(ctx.scope.role, { roles: OWNER })) out.push('', `Shop Labor Rate: $${ctx.scope.laborRate}/Hr (From Settings).`);
  const links = [...new Map(hist.items.map((x: any) => [x.open_path, { label: `${x.source} ${x.number}`.trim(), path: x.open_path }])).values()].slice(0, 3);
  return {
    reply: out.join('\n'),
    staff: { tool_results: [
      { label: 'Shop Labor History', module: 'Estimates, Repair Orders, Invoices', status: hist.status, count: hist.items.length, partial: !!hist.partial },
      { label: 'Labor Guide', status: 'not_connected' },
      { label: 'Rough Guidance', status: rough ? 'ok' : 'unavailable' },
    ], links, read_only: true },
    audit: canHistory ? ['labor.history'] : [],
  };
}