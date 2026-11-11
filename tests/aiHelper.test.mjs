// LBC Auto AI helper upgrade: repair-question parsing, typical parts guidance, shop-date handling and
// widget readability wiring. Synthetic in-memory shops only: no network, no real records, no sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createStore } from './helpers/fakeShopStore.mjs';
import { handleStaffTurn } from '../base44/shared/staffAssistant/handler.ts';
import { laborIntent, parseVehicle, parseJob, stripInstructions } from '../base44/shared/staffAssistant/laborTime.ts';
import { partsIntent, partsTurn, sanitizeParts, PARTS_ASK } from '../base44/shared/staffAssistant/partsTurn.ts';
import { resolveStaffScope, todayIn, dayStartUtc, NO_SHOP_TZ } from '../base44/shared/staffAssistant/scope.ts';
import { createTypewriter, chunkFor, MAX_REVEAL_TICKS } from '../src/lib/typewriter.js';
import { toDisplayMarkdown, toPlainText } from '../src/lib/aiTextFormat.js';

const NOW = Date.parse('2026-11-11T02:34:00Z'); // Nov 10, 21:34 in Toronto; already Nov 11 in UTC
const A = { id: 'uA', email: 'a@shop.com', business_name: 'A Shop', subscription_status: 'active', labor_rate: 100, timezone: 'America/Toronto' };
const NO_TZ = { ...A, timezone: null };
const OBSERVED = 'labor h 2015 honda civic front brake pads. Read Only. Distinguish Actual Saved From Hourly Rates Any General Estimate.';
const TYPICAL = { known: true, required: [{ name: 'Front Brake Pad Set', qty: '1 Set' }, { name: 'Brake Hardware Kit', qty: '1' }, { name: 'Pad PN-12345X', qty: '1' }],
  if_worn: [{ name: 'Front Brake Rotors', qty: '2', note: 'If Below Minimum Thickness' }], optional: [{ name: 'Brake Fluid', qty: '1 Bottle', note: '$12 at supplier' }] };
const ROUGH = { low_hours: 1.2, high_hours: 1.8, note: 'Seized hardware adds time.' };

async function setup() {
  const s = createStore();
  const a = s.client('uA'), b = s.client('uB'), svc = s.client('service_1');
  await a.Part.create({ name: 'Ceramic Brake Pad Front', part_number: 'D1089-C', quantity: 3, sale_price: 89, cost_price: 40 });
  await b.Part.create({ name: 'Brake Pad Other Shop', quantity: 9, shop_owner_email: 'a@shop.com' }); // forged stamp
  await svc.Part.create({ name: 'Brake Pad Shop B', quantity: 9, shop_owner_email: 'b@shop.com' });
  await svc.LineItemLibrary.create({ shop_owner_email: 'a@shop.com', item_name: 'Front Brake Labor', type: 'labor', last_unit_price: 120, times_used: 10 });
  await a.Appointment.create({ customer_id: 'c1', vehicle_id: 'v1', service_type: 'Oil Change Nov10', date: '2026-11-10', time_slot: '9:00' });
  await a.Appointment.create({ customer_id: 'c1', vehicle_id: 'v1', service_type: 'Tire Swap Nov11', date: '2026-11-11', time_slot: '9:00' });
  return { s, svc };
}
function llmFake(plan, log = []) {
  return async (p) => {
    log.push(p);
    const props = p.response_json_schema?.properties || {};
    if (props.calls) return structuredClone(plan);
    if (props.required) return structuredClone(TYPICAL);
    if (props.low_hours) return ROUGH;
    return 'composed reply';
  };
}
const turn = (env, user, text, { plan, log, page, svc } = {}) => handleStaffTurn({ userDb: env.s.client(user.id), svc: svc || env.svc, user, llm: llmFake(plan, log), now: NOW,
  body: { messages: Array.isArray(text) ? text : [{ role: 'user', content: text }], page } });
const WRITE_TABLES = ['Estimate', 'RepairOrder', 'Invoice', 'Customer', 'Vehicle', 'DocumentDelivery', 'StripeCheckoutLink', 'PaymentRecord'];
const noWrites = (env) => WRITE_TABLES.forEach((t) => assert.equal(env.s.tables[t]?.length ?? 0, 0, `${t} untouched`));

test('short labor question and instruction-stripped repair extraction (observed live text)', () => {
  assert.equal(laborIntent('labor h 2015 civic front pads'), 'repair_hours');
  const text = stripInstructions(OBSERVED);
  assert.ok(!/read|distinguish|hourly|general/i.test(text), text);
  const v = parseVehicle(text);
  const job = parseJob(text, v.used);
  assert.equal(v.label, '2015 Honda Civic');
  assert.equal(job.label, 'Brake Pads');
  assert.deepEqual(job.sides, ['front']);
  assert.equal(stripInstructions('2015 Civic, do not change anything, front pads'), '2015 Civic front pads');
});

test('labor reply: job title has no instructions; $120 price is never hours; no licensed guide is said', async () => {
  const env = await setup();
  const out = await turn(env, A, OBSERVED);
  assert.ok(out.reply.startsWith('**Labor Time: Brake Pads (Front) - 2015 Honda Civic**'), out.reply.split('\n')[0]);
  assert.ok(!/Distinguish|Read Only/i.test(out.reply));
  assert.ok(!/120\s*h/.test(out.reply) && /Stores No Hours/.test(out.reply));
  assert.match(out.reply, /No Licensed Labor Guide Is Connected/);
  assert.match(out.reply, /Rough Guidance \(Not Book Time\)/);
  assert.deepEqual(out.staff.options, ['Parts Needed For Brake Pads (Front) 2015 Honda Civic']);
  noWrites(env);
});

test('parts intent: parts questions route to parts guidance; inventory/stock questions do not', () => {
  assert.ok(partsIntent('what parts do i need for front brakes on a 2015 civic'));
  assert.ok(partsIntent('Parts Needed For Brake Pads (Front) 2015 Honda Civic'));
  assert.ok(!partsIntent('which parts are low on stock'));
  assert.ok(!partsIntent('price lib brake parts'));
});

test('missing vehicle details: one short question, no lookups, no model call', async () => {
  const env = await setup();
  const log = [];
  const out = await turn(env, A, 'what parts are needed for front brake pads and rotors?', { log });
  assert.ok(out.reply.startsWith(PARTS_ASK));
  assert.match(out.reply, /Which Vehicle\?/);
  assert.equal(out.staff.tool_results[0].status, 'needs_input');
  assert.equal(log.length, 0);
  const follow = await turn(env, A, [{ role: 'user', content: 'what parts are needed for front brake pads' }, { role: 'assistant', content: out.reply }, { role: 'user', content: '2015 honda civic' }], { log });
  assert.ok(follow.reply.startsWith('**Parts Needed: Brake Pads (Front) - 2015 Honda Civic**'));
  const plugs = await turn(env, A, 'parts needed for spark plugs 2015 honda civic');
  assert.match(plugs.reply, /Which Engine\?/);
});

test('typical vs verified parts: labelled not verified, same-shop inventory name match only, no part numbers or prices from the model', async () => {
  const env = await setup();
  const out = await turn(env, A, 'what parts do i need for front brake pads on a 2015 honda civic');
  const r = out.reply;
  assert.match(r, /Typical Parts, Fitment Not Verified\./);
  assert.match(r, /\*\*Required For This Repair\*\*\n- Front Brake Pad Set - 1 Set\n- Brake Hardware Kit - 1/);
  assert.match(r, /\*\*Inspect, Replace Only If Worn\*\*\n- Front Brake Rotors - 2 \(If Below Minimum Thickness\)/);
  assert.ok(!/PN-12345X|\$12/.test(r), 'model part numbers and prices are dropped');
  assert.match(r, /In Your Inventory\*\* \(Name Match Only, Fitment Not Verified\)\n- Ceramic Brake Pad Front \(D1089-C\) - 3 On Hand/);
  assert.ok(!/Other Shop|Shop B|\b89\b|\b40\b/.test(r), 'other shops, sale and cost prices never shown');
  assert.match(r, /No Licensed Labor Guide Is Connected/);
  assert.deepEqual(out.staff.links, [{ label: 'Parts Lookup', path: '/PartsLookup' }]);
  assert.deepEqual(out.staff.tool_results.map((x) => [x.label, x.status]), [['Typical Parts (Not Verified)', 'ok'], ['Parts Inventory', 'ok'], ['Parts Fitment', 'not_connected']]);
  assert.equal(out.staff.read_only, true);
  noWrites(env);
  assert.deepEqual(env.s.tables.StaffAssistantAction.map((x) => [x.kind, x.tools_used.join()]), [['turn', 'parts.search']]);
});

test('unavailable is never "no matches": inventory down, typical parts down, and a real empty inventory', async () => {
  const env = await setup();
  const down = await turn(env, A, 'parts needed for front brake pads 2015 honda civic', { svc: env.s.client('service_1', { Part: true }) });
  assert.match(down.reply, /Your Inventory Could Not Be Checked Right Now\./);
  assert.ok(!/No Matching Parts/.test(down.reply));
  const failing = await handleStaffTurn({ userDb: env.s.client('uA'), svc: env.svc, user: A, now: NOW, llm: async () => { throw new Error('timeout'); },
    body: { messages: [{ role: 'user', content: 'parts needed for front brake pads 2015 honda civic' }] } });
  assert.match(failing.reply, /Typical Parts Are Unavailable Right Now/);
  assert.equal(failing.retryable, true);
  const pump = async (p) => (p.response_json_schema ? { known: true, required: [{ name: 'Water Pump Assembly', qty: '1' }, { name: 'Coolant', qty: '1 Jug' }] } : 'x');
  const empty = await handleStaffTurn({ userDb: env.s.client('uA'), svc: env.svc, user: A, now: NOW, llm: pump, body: { messages: [{ role: 'user', content: 'parts needed for water pump 2015 honda civic 1.8l' }] } });
  assert.ok(empty.reply.startsWith('**Parts Needed: Water Pump - 2015 Honda Civic 1.8L**'));
  assert.match(empty.reply, /No Matching Parts In Your Inventory\./);
});

test('role scope: technician never sees part prices; an unknown role gets no inventory', async () => {
  const env = await setup();
  const scope = resolveStaffScope(A, NOW);
  const ctx = (role) => ({ svc: env.svc, scope: { ...scope, role }, now: new Date(NOW), page: null });
  const tech = await partsTurn(ctx('technician'), llmFake(), [{ role: 'user', content: 'parts needed for front brake pads 2015 honda civic' }]);
  assert.match(tech.reply, /Ceramic Brake Pad Front/);
  assert.ok(!/\b89\b/.test(tech.reply));
  const other = await partsTurn(ctx('guest'), llmFake(), [{ role: 'user', content: 'parts needed for front brake pads 2015 honda civic' }]);
  assert.match(other.reply, /Inventory Is Not Available For Your Role\./);
  assert.deepEqual(other.audit, []);
});

test('sanitizeParts keeps generic names and quantities only', () => {
  assert.deepEqual(sanitizeParts([{ name: 'Front Brake Pad Set', qty: '1 Set' }, { name: 'ACDelco 18A2324', qty: '1' }, { name: 'Oil', note: 'about 25 dollars' }, { name: '5W-30 Oil', qty: '4.4 L' }]).map((p) => p.name), ['Front Brake Pad Set', '5W-30 Oil']);
});

test('shop day: Nov 10 in Toronto while UTC is Nov 11; DST boundaries', () => {
  assert.equal(todayIn('America/Toronto', new Date(NOW)), '2026-11-10');
  assert.equal(todayIn('UTC', new Date(NOW)), '2026-11-11');
  assert.equal(dayStartUtc('2026-10-31', 'America/Toronto'), '2026-10-31T04:00:00.000Z'); // EDT
  assert.equal(dayStartUtc('2026-11-01', 'America/Toronto'), '2026-11-01T04:00:00.000Z'); // DST ends 02:00 that day
  assert.equal(dayStartUtc('2026-11-02', 'America/Toronto'), '2026-11-02T05:00:00.000Z'); // EST
  assert.equal(dayStartUtc('2026-03-08', 'America/Toronto'), '2026-03-08T05:00:00.000Z');
  assert.equal(dayStartUtc('2026-03-09', 'America/Toronto'), '2026-03-09T04:00:00.000Z');
});

test('"today" appointments use the verified shop day; no shop timezone asks for a date instead of using UTC', async () => {
  const env = await setup();
  const plan = { calls: [{ name: 'appointments.list', args: [] }], unsupported: 'none' };
  const log = [];
  const ok = await turn(env, A, 'what appointments do we have today?', { plan, log });
  const data = log.at(-1).prompt;
  assert.ok(data.includes('Oil Change Nov10') && !data.includes('Tire Swap Nov11'), 'Toronto Nov 10, not UTC Nov 11');
  assert.equal(ok.reply, 'composed reply');
  const log2 = [];
  const noTz = await turn(env, NO_TZ, 'what appointments do we have today?', { plan, log: log2 });
  assert.equal(noTz.reply, NO_SHOP_TZ);
  assert.equal(noTz.staff.tool_results[0].status, 'needs_input');
  assert.equal(log2.length, 1, 'planner only; no compose with a guessed day');
  assert.ok(log2[0].prompt.includes('Today (shop time) is unknown') && !log2[0].prompt.includes('2026-11-11'));
  const explicit = await turn(env, NO_TZ, 'appointments on 2026-11-10', { plan: { calls: [{ name: 'appointments.list', args: [{ key: 'from', value: '2026-11-10' }, { key: 'to', value: '2026-11-10' }] }], unsupported: 'none' }, log: log2 });
  assert.equal(explicit.reply, 'composed reply');
  assert.ok(log2.at(-1).prompt.includes('Oil Change Nov10'));
});

test('reply display: line breaks kept, VINs and part numbers untouched, copy text complete', () => {
  const md = '**Required For This Repair**\n- Front Brake Pad Set - 1 Set\n**Next Step**\nVIN 1HGCM82633A004352, D1089-C, 4.4 L';
  const shown = toDisplayMarkdown(md);
  assert.equal(shown, '**Required For This Repair**\n\n- Front Brake Pad Set - 1 Set\n\n**Next Step**  \nVIN 1HGCM82633A004352, D1089-C, 4.4 L');
  assert.match(toPlainText(md), /1HGCM82633A004352, D1089-C, 4\.4 L/);
});

test('long replies reveal fully within the tick cap (no half-typed wait for Show Full Reply)', () => {
  const text = 'Brake job details. '.repeat(160); // ~3000 chars
  let ticks = 0, last = '';
  const queue = [];
  const tw = createTypewriter({ chunk: chunkFor(text), schedule: (fn) => { queue.push(fn); return queue.length; }, cancel: () => {}, now: () => 0,
    onUpdate: (s) => { last = s; }, onDone: () => {} });
  tw.push(text); tw.end();
  while (queue.length) { queue.shift()(); ticks++; }
  assert.equal(last, text);
  assert.ok(ticks <= MAX_REVEAL_TICKS + 2, `ticks ${ticks}`);
  assert.equal(chunkFor('short reply'), 1);
});

const src = (f) => readFileSync(f, 'utf8');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('widget: one shared circular launcher, readable panel, minimize keeps draft, no duplicate copy control', () => {
  const ui = src('src/components/shared/AutoAIBubble.jsx');
  const css = src('src/components/staff-ai/aiChatStyles.js');
  const usages = walk('src').filter((f) => /\.jsx?$/.test(f)).filter((f) => src(f).includes('<AutoAIBubble'));
  assert.deepEqual(usages, ['src/Layout.jsx']);
  assert.match(css, /\.lbc-ai-orb \{[^}]*border-radius: 50%/);
  assert.match(src('src/components/staff-ai/AiLauncher.jsx'), /size=\{compact \? 56 : 60\}/);
  assert.match(src('src/components/staff-ai/AiLauncher.jsx'), /lbc-ai-launcher-label">LBC Auto AI</);
  assert.match(src('src/components/staff-ai/AiChatHeader.jsx'), /<LbcAutoLogo size="sm" \/>/);
  assert.match(src('src/components/staff-ai/AiChatHeader.jsx'), /aria-label="Minimize LBC Auto AI"/);
  assert.match(css, /width: min\(440px, calc\(100vw - 40px\)\)/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.lbc-ai-panel \{ width: 100%/);
  assert.match(css, /\.lbc-ai-bubble \{[^}]*font-size: 15px; line-height: 1\.55/);
  assert.match(css, /\.lbc-ai-input \{[^}]*font-size: 16px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(ui, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); setOpen\(false\); \}/);
  assert.match(ui, /if \(!text\) setInput\(""\)/);
  assert.ok(!ui.includes('CopyTextButton'));
  assert.match(ui, /showCopy=\{!m\.staff\?\.confirmation\}/);
  assert.match(src('src/components/staff-ai/AiComposer.jsx'), /e\.key === "Enter" && !e\.shiftKey/);
  assert.match(src('src/hooks/useTypewriter.js'), /prefers-reduced-motion: reduce/);
});

test('invoice and estimate editors are not touched by the widget upgrade', () => {
  for (const f of ['src/components/invoices/OriginalInvoiceEditor.jsx', 'src/components/estimates/OriginalEstimateEditor.jsx']) assert.ok(!/lbc-ai-|AutoAIBubble/.test(src(f)));
});