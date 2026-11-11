// LBC Auto AI labor-time lookup: real ownerRequest -> handler -> labor turn / planner -> response ->
// frontend request normalizer, against an in-memory synthetic shop store (no network, no real data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from './helpers/fakeShopStore.mjs';
import { handleOwnerRequest } from '../base44/shared/staffAssistant/ownerRequest.ts';
import { laborIntent, parseVehicle, parseJob } from '../base44/shared/staffAssistant/laborTime.ts';
import { LABOR_ASK } from '../base44/shared/staffAssistant/laborTurn.ts';
import { requestAiReply, normalizeAiResponse } from '../src/lib/aiChatRequest.js';

const NOW = Date.parse('2026-11-10T12:00:30Z');
const A = { id: 'uA', email: 'a@shop.com', business_name: 'A Shop', subscription_status: 'active', labor_rate: 100, tax_rate: 13, timezone: 'America/Toronto' };
const ROUGH = { low_hours: 1.2, high_hours: 1.8, note: 'Seized hardware adds time.' };

async function setup() {
  const s = createStore();
  const a = s.client('uA'), b = s.client('uB'), svc = s.client('service_1');
  const ro = await a.RepairOrder.create({ order_number: 'RO-1', vehicle_info: '2015 Honda Civic', customer_id: 'c1', vehicle_id: 'v1', description: 'brakes', labor_items: [{ description: 'Front Brake Pads And Rotors', hours: 1.6, rate: 100, total: 160 }] });
  await a.Estimate.create({ estimate_number: 'EST-1', estimate_date: '2026-05-01', vehicle_info: '2016 Honda Civic', labor_items: [{ description: 'Front brake pads', hours: 1.4, rate: 100, total: 140 }] });
  await a.Invoice.create({ invoice_number: 'INV-1', invoice_date: '2026-06-01', vehicle_info: '2015 Honda Civic', total: 150, line_items: [{ type: 'labor', name: 'Front Brake Pads', quantity: 1.5, unit_price: 100, total: 150 }] });
  await a.Invoice.create({ invoice_number: 'INV-2', vehicle_info: '2015 Honda Civic', total: 220, line_items: [{ type: 'labor', name: 'Front Brake Pads', quantity: 1, unit_price: 220, total: 220 }] });
  await a.Invoice.create({ invoice_number: 'INV-3', vehicle_info: '2015 Honda Civic', total: 90, discount: 10, line_items: [{ type: 'labor', name: 'Front Brake Pads', quantity: 1, unit_price: 100, total: 100 }] });
  const other = await b.RepairOrder.create({ order_number: 'RO-B', vehicle_info: '2019 Ford F-150 Raptor', labor_items: [{ description: 'Front Brake Pads', hours: 9.9 }] });
  await b.RepairOrder.create({ order_number: 'RO-B2', vehicle_info: '2015 Honda Civic', labor_items: [{ description: 'Front Brake Pads', hours: 9.9 }] });
  await svc.LineItemLibrary.create({ shop_owner_email: 'a@shop.com', item_name: 'Front Brake Pads', type: 'labor', last_unit_price: 160, times_used: 3 });
  await a.TimeEntry.create({ shop_owner_email: 'a@shop.com', mechanic_id: 'm1', mechanic_name: 'Mike', date: '2026-11-10', clock_in: 'x', duration_minutes: 480 });
  return { s, svc, ro, other };
}

function app(env, { user = A, llm, llmMs } = {}) {
  const calls = [];
  const base44 = {
    auth: { me: async () => { if (user instanceof Error) throw user; return user; } },
    entities: env.s.client(user?.id), asServiceRole: { entities: env.svc },
    integrations: { Core: { InvokeLLM: (p) => { calls.push(p); return (llm || (async (q) => (q.response_json_schema ? ROUGH : 'composed reply')))(p); } } },
  };
  // Browser side: functions.invoke resolves {data} on 2xx and throws an axios-style error otherwise.
  const invoke = async (_name, body) => {
    const out = await handleOwnerRequest({ base44, body, messages: body.messages || [], mode: body.mode, now: NOW, llmMs });
    if (out.status >= 400) throw Object.assign(new Error('http'), { response: { status: out.status, data: out.json } });
    return { data: out.json };
  };
  const ask = (messages, extra = {}) => requestAiReply(invoke, { mode: 'owner', messages: typeof messages === 'string' ? [{ role: 'user', content: messages }] : messages, ...extra }, { timeoutMs: extra.timeoutMs || 2000 });
  return { ask, calls };
}

test('intent: shorthand and misspellings are repair labor time; rate, timesheet and codes are separate', () => {
  for (const t of ['labor h', 'checking a labor h', 'labour hours water pump', 'labor hrs', 'lbr hrs', 'labr time', 'book time front struts', 'how many hours for a timing belt', 'how long to replace alternator'])
    assert.equal(laborIntent(t), 'repair_hours', t);
  assert.equal(laborIntent('what is my labor rate'), 'labor_rate');
  assert.equal(laborIntent('how many hours did Mike work this week'), 'timesheet');
  assert.equal(laborIntent('hours worked today'), 'timesheet');
  assert.equal(laborIntent('what does P0420 mean and how many hours to fix'), null);
  const v = parseVehicle('labour hrs water pump 2012 ford f-150 3.5l');
  assert.deepEqual([v.year, v.make, v.model, v.engine, v.complete], ['2012', 'ford', 'f-150', '3.5L', true]);
  assert.deepEqual(parseJob('labour hrs water pump 2012 ford f-150 3.5l', v.used).tokens, ['water', 'pump']);
});

test('"labor h" with nothing else asks targeted questions at once, never plans or writes', async () => {
  const env = await setup();
  const { ask, calls } = app(env);
  const out = await ask('fix lbc auto ai im asking him for checking a labor h');
  assert.ok(out.ok && out.content.startsWith(LABOR_ASK));
  assert.match(out.content, /Which Vehicle\? Give Year, Make And Model/);
  assert.match(out.content, /Which Repair\?/);
  assert.equal(calls.length, 0, 'no planner or model call');
  assert.equal(out.data.staff.read_only, true);
  assert.equal(env.s.tables.Estimate.length, 1);
});

test('follow-up answer: tenant-scoped history (exact vs comparable), no guide, labelled rough guidance', async () => {
  const env = await setup();
  const { ask, calls } = app(env);
  const first = await ask('labor h');
  const out = await ask([{ role: 'user', content: 'labor h' }, { role: 'assistant', content: first.content }, { role: 'user', content: '2015 honda civic front brake pads' }]);
  const c = out.content;
  assert.match(c, /Labor Time: Brake Pads \(Front\) - 2015 Honda Civic/);
  assert.match(c, /Exact Match: 1\.5 h - Invoice INV-1, 2026-06-01/);
  assert.match(c, /Exact Match: 1\.6 h - Repair Order RO-1/);
  assert.match(c, /Comparable Job: 1\.4 h - Estimate EST-1/);
  assert.match(c, /2 Matching Line\(s\) Had No Saved Hours/); // flat-priced and discounted invoices
  assert.match(c, /Price Library Has A Price For This Item, But It Stores No Hours/);
  assert.match(c, /No Licensed Labor Guide Is Connected/);
  assert.match(c, /Rough Guidance \(Not Book Time\)\*\*\nAbout 1\.2-1\.8 h\. Seized hardware adds time\. Verify With A Labor Guide/);
  assert.ok(!/9\.9|RO-B|\$|480|(^|[^.\d])8(\.0)? h/.test(c), 'no other shop, no prices, no timesheet hours');
  assert.equal(calls.length, 1);
  assert.ok(!/Honda|RO-1|INV/.test(calls[0].prompt.split('Vehicle:')[0]), 'rough-guidance prompt carries no shop records');
  assert.deepEqual(out.data.staff.tool_results.map((r) => r.status), ['ok', 'not_connected', 'ok']);
  assert.equal(env.s.tables.Estimate.length, 1, 'read-only: no estimate created');
  assert.ok(env.s.tables.StaffAssistantAction.every((r) => r.kind === 'turn'));
  assert.ok(out.data.staff.links.every((l) => /^\/(RepairOrderDetail|InvoiceDetail|EstimateDetail)\//.test(l.path)));
});

test('axle-specific jobs ask which side instead of guessing', async () => {
  const env = await setup();
  const out = await app(env).ask('labor hours brake pads 2015 honda civic');
  assert.match(out.content, /Which Side Or Axle For Brake Pads/);
});

test('page context is revalidated server-side; another shop\'s record is never used or revealed', async () => {
  const env = await setup();
  const own = await app(env).ask('labor hrs water pump', { page: `/RepairOrderDetail/${env.ro.id}` });
  assert.match(own.content, /Water Pump - 2015 Honda Civic/);
  assert.match(own.content, /Vehicle From This Repair Order/);
  const forged = await app(env).ask('labor hrs water pump', { page: `/RepairOrderDetail/${env.other.id}` });
  assert.ok(forged.content.startsWith(LABOR_ASK));
  assert.ok(!/Ford|F-150|RO-B/.test(forged.content));
});

test('labor rate answers from settings; timesheets go to the planner, which is told they are not labor hours', async () => {
  const env = await setup();
  const r = app(env);
  const rate = await r.ask('what is my labor rate');
  assert.match(rate.content, /\$100\/Hr \(From Settings\)\. That Is Your Hourly Price, Not How Long A Job Takes/);
  assert.equal(r.calls.length, 0);
  const t = app(env, { llm: async (p) => (p.response_json_schema ? { calls: [{ name: 'time.summary', args: {} }] } : 'Mike worked 8 hours (From Time Tracking).') });
  const ts = await t.ask('how many hours did Mike work today');
  assert.match(t.calls[0].prompt, /time\.summary is employee clock time only, never repair labor hours/);
  assert.match(t.calls[0].prompt, /Use estimates\.create ONLY when the staff explicitly asks/);
  assert.match(ts.content, /From Time Tracking/);
});

test('malformed rough guidance still returns the full labor answer', async () => {
  const env = await setup();
  const out = await app(env, { llm: async () => 'garbage' }).ask('book time 2015 honda civic water pump');
  assert.ok(out.ok);
  assert.match(out.content, /Rough Guidance Is Unavailable Right Now/);
  assert.match(out.content, /No Licensed Labor Guide Is Connected/);
});

test('empty, malformed, slow and failing model replies always produce a visible, retryable answer', async () => {
  const env = await setup();
  const empty = await app(env, { llm: async (p) => (p.response_json_schema ? { calls: [] } : '   ') }).ask('hello there');
  assert.equal(empty.retryable, true);
  assert.match(empty.content, /Empty Answer/);
  const obj = await app(env, { llm: async (p) => (p.response_json_schema ? 'not json' : { content: 'Hi! How Can I Help?' }) }).ask('hello there');
  assert.equal(obj.content, 'Hi! How Can I Help?');
  const slow = await app(env, { llm: () => new Promise(() => {}), llmMs: 20 }).ask('hello there');
  assert.equal(slow.retryable, true);
  assert.match(slow.content, /Took Too Long/);
  const boom = await app(env, { llm: async () => { throw new Error('upstream'); } }).ask('hello there');
  assert.equal(boom.retryable, true);
  assert.match(boom.content, /Unavailable Right Now/);
  const compose = await app(env, { llm: async (p) => { if (p.response_json_schema) return { calls: [{ name: 'customers.search', args: {} }] }; throw new Error('x'); } }).ask('list customers');
  assert.match(compose.content, /Could Not Write The Answer/);
  assert.equal(compose.data.staff.tool_results[0].label, 'Customer Search');
});

test('rate limit, sign-in failure, rejection and frontend deadline each show a clear message', async () => {
  const env = await setup();
  for (let i = 0; i < 21; i++) await env.svc.StaffAssistantAction.create({ actor_user_id: 'uA', shop_owner_email: 'a@shop.com', kind: 'turn', status: 'logged' });
  const limited = await app(env).ask('labor h');
  assert.equal(limited.errorCode, 'rate_limited');
  assert.equal(limited.retryable, true);
  const noAuth = await app(env, { user: new Error('401') }).ask('labor h');
  assert.equal(noAuth.content, 'Sign In Again To Use LBC Auto AI.');
  assert.equal(noAuth.retryable, false);
  const net = await requestAiReply(async () => { throw new TypeError('Failed to fetch'); }, {});
  assert.equal(net.errorCode, 'network');
  assert.equal(net.retryable, true);
  const hung = await requestAiReply(() => new Promise(() => {}), {}, { timeoutMs: 15 });
  assert.match(hung.content, /Took Too Long/);
  assert.equal(normalizeAiResponse({}).content.length > 0, true);
  assert.equal(normalizeAiResponse(null).retryable, true);
});

test('Retry is read-only: a write proposal is never prepared on retry', async () => {
  const env = await setup();
  const plan = { calls: [{ name: 'estimates.create', args: { customer: 'John' } }] };
  const out = await app(env, { llm: async () => plan }).ask('make an estimate for John', { read_only: true });
  assert.match(out.content, /Retry Only Repeats Lookups/);
  assert.ok(env.s.tables.StaffAssistantAction.every((r) => r.kind === 'turn'));
});

test('UI wiring: deadline helper, stale-reply guard, loading reset in finally, Retry only on failed answers', () => {
  const ui = readFileSync('src/components/shared/AutoAIBubble.jsx', 'utf8');
  assert.match(ui, /requestAiReply\(\(name, p\) => base44\.functions\.invoke\(name, p\), payload\)/);
  assert.match(ui, /if \(seq !== requestSeqRef\.current\) return;/);
  assert.match(ui, /\} finally \{\n\s*if \(seq === requestSeqRef\.current\) setLoading\(false\);/);
  assert.match(ui, /read_only: retryOf \? true : undefined/);
  assert.match(ui, /m\.retry && idx === messages\.length - 1/);
  const decide = ui.slice(ui.indexOf('const decide = async'), ui.indexOf('const placeholder'));
  assert.ok(!/retry/.test(decide.replace(/never retried/, '')), 'confirmations get no Retry');
  assert.ok(!/No response generated/.test(ui));
});