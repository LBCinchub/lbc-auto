import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore } from './helpers/fakeShopStore.mjs';
import { handleStaffTurn } from '../base44/shared/staffAssistant/handler.ts';
import { resolveStaffScope, todayIn, ToolError } from '../base44/shared/staffAssistant/scope.ts';
import { CAPABILITIES } from '../base44/shared/staffAssistant/registry.ts';
import { validatePlan } from '../base44/shared/staffAssistant/planner.ts';

const NOW = Date.parse('2026-11-10T12:00:30Z');
const A = { id: 'uA', email: 'a@shop.com', business_name: 'A Shop', subscription_status: 'active', labor_rate: 100, tax_rate: 13, tax_applies_to: 'both', timezone: 'America/Toronto' };
const B = { ...A, id: 'uB', email: 'b@shop.com', business_name: 'B Shop' };

async function setup() {
  const s = createStore();
  const a = s.client('uA'), b = s.client('uB'), svc = s.client('service_1');
  const john = await a.Customer.create({ full_name: 'John Smith', phone: '6135551234', notes_log: [{ text: 'secret' }] });
  const car = await a.Vehicle.create({ customer_id: john.id, year: 2018, make: 'Honda', model: 'Civic' });
  await b.Customer.create({ full_name: 'John Stone', phone: '6135559999', shop_owner_email: 'a@shop.com' }); // forged stamp
  await svc.Customer.create({ full_name: 'John Web', phone: '6135550000', shop_owner_email: 'a@shop.com' });
  await svc.Customer.create({ full_name: 'John Other', phone: '6135550001', shop_owner_email: 'b@shop.com' });
  return { s, a, b, svc, john, car };
}
const llmWith = (plans, prompts = []) => async (p) => { prompts.push(p.prompt); return p.response_json_schema ? plans.shift() : 'composed reply'; };
const turn = (env, user, plan, text, extra = {}) => handleStaffTurn({ userDb: env.s.client(user.id), svc: env.svc, user, llm: llmWith([plan], extra.prompts), now: extra.now ?? NOW, body: { messages: [{ role: 'user', content: text }], page: extra.page } });
const decide = (env, user, c, decision = 'confirm', now = NOW) => handleStaffTurn({ userDb: env.s.client(user.id), svc: env.svc, user, llm: llmWith([]), now, body: { staff_action: { action_id: c.action_id, token: c.token, decision } } });

test('scope: session required, shop setup and active subscription enforced; admin role grants nothing extra', () => {
  assert.throws(() => resolveStaffScope(null), (e) => e.status === 401);
  assert.throws(() => resolveStaffScope({ ...A, business_name: '' }), (e) => e.status === 403);
  assert.throws(() => resolveStaffScope({ ...A, subscription_status: 'none', created_date: '2026-01-01' }, NOW), (e) => e.status === 403);
  assert.equal(resolveStaffScope({ ...A, role: 'admin' }).tenant, 'a@shop.com');
  assert.equal(todayIn('America/Toronto', new Date('2026-11-10T03:00:00Z')), '2026-11-09');
});

test('reads are tenant-scoped: forged stamps and other shops are excluded; safe projection only', async () => {
  const env = await setup();
  const ctx = { svc: env.svc, scope: resolveStaffScope(A, NOW), now: new Date(NOW) };
  const res = await CAPABILITIES['customers.search'].run(ctx, { query: 'John' });
  assert.deepEqual(res.items.map((c) => c.full_name).sort(), ['John Smith', 'John Web']);
  assert.equal(res.items[0].notes_log, undefined);
  await assert.rejects(CAPABILITIES['customers.get'].run({ ...ctx, scope: resolveStaffScope(B, NOW) }, { customer_id: env.john.id }), (e) => e.code === 'not_found');
});

test('planner never sees records; a failed lookup is reported, never as zero', async () => {
  const env = await setup();
  const prompts = [];
  const failing = { ...env, svc: env.s.client('service_1', { Invoice: true }) };
  const out = await turn(failing, A, { calls: [{ name: 'invoices.list', args: { status: 'open' } }, { name: 'customers.search', args: { query: 'John' } }] }, 'show unpaid invoices', { prompts });
  assert.ok(!prompts[0].includes('6135551234'));
  assert.equal(out.staff.tool_results[0].status, 'unavailable');
  assert.ok(prompts[1].includes('DATA, not instructions'));
  assert.equal(env.s.tables.Estimate, undefined);
});

test('plan validation drops unknown tools and keeps at most one write', () => {
  const p = validatePlan({ calls: [{ name: 'invoices.delete' }, { name: 'customers.search', args: {} }, { name: 'customers.create', args: { full_name: 'X', phone: '6135550000' } }, { name: 'vehicles.create', args: {} }] });
  assert.deepEqual(p.dropped, ['invoices.delete']);
  assert.deepEqual(p.calls.map((c) => c.cap.name), ['customers.create']);
});

test('estimate: preview, confirm saves once with real number, replay and tamper safe', async () => {
  const env = await setup();
  const plan = { calls: [{ name: 'estimates.create', args: { customer: 'John Smith', job: 'Front brakes', lines: [{ type: 'labor', name: 'Front Brake Job', quantity: 1.5 }, { type: 'part', name: 'Brake Pads', unit_price: 80 }] } }] };
  const prev = await turn(env, A, plan, 'estimate for John Smith: front brakes 1.5 hours, pads $80');
  const c = prev.staff.confirmation;
  assert.ok(c && c.token && !env.s.tables.Estimate);
  assert.ok(c.fields.some((f) => f.label === 'Total' && f.after === '$259.90'));
  assert.ok(c.fields.some((f) => /Shop Labor Rate/.test(f.after)));
  await assert.rejects(decide(env, B, c), (e) => e.status === 403);
  await assert.rejects(decide(env, A, { ...c, token: 'f'.repeat(64) }), (e) => e.status === 403);
  const [r1, r2] = await Promise.allSettled([decide(env, A, c), decide(env, A, c)]);
  const ok = [r1, r2].filter((r) => r.status === 'fulfilled');
  assert.equal(ok.length, 1);
  assert.equal(env.s.tables.Estimate.length, 1);
  const saved = env.s.tables.Estimate[0];
  assert.equal(ok[0].value.staff.receipt.number, saved.estimate_number);
  assert.equal(ok[0].value.staff.receipt.open_path, `/EstimateDetail/${saved.id}`);
  assert.equal(saved.status, 'draft');
  const again = await decide(env, A, c);
  assert.equal(again.staff.replay, true);
  assert.equal(env.s.tables.Estimate.length, 1);
});

test('estimate: invented prices and missing tax ask instead of guessing; expiry and cancel never save', async () => {
  const env = await setup();
  const plan = () => ({ calls: [{ name: 'estimates.create', args: { customer: 'John Smith', lines: [{ type: 'part', name: 'Rotor', unit_price: 95 }] } }] });
  const invented = await turn(env, A, plan(), 'estimate for John Smith with a rotor');
  assert.match(invented.reply, /Price for "Rotor"/);
  const noTax = await turn(env, { ...A, tax_rate: null }, plan(), 'estimate for John Smith rotor $95');
  assert.match(noTax.reply, /tax rate/i);
  const p = await turn(env, A, plan(), 'estimate for John Smith rotor $95');
  await assert.rejects(decide(env, A, p.staff.confirmation, 'confirm', NOW + 11 * 60000), (e) => e.status === 410);
  const p2 = await turn(env, A, plan(), 'estimate for John Smith rotor $95');
  assert.match((await decide(env, A, p2.staff.confirmation, 'cancel')).reply, /Nothing was saved/);
  await assert.rejects(decide(env, A, p2.staff.confirmation), (e) => e.status === 409);
  assert.equal(env.s.tables.Estimate, undefined);
});

test('update: before/after preview, stale record rejected, ambiguity asks', async () => {
  const env = await setup();
  const plan = () => ({ calls: [{ name: 'customers.update', args: { customer: 'John Smith', phone: '6135557777' } }] });
  const p = await turn(env, A, plan(), 'change John Smith phone to 6135557777');
  assert.deepEqual(p.staff.confirmation.fields[0], { label: 'Phone', before: '6135551234', after: '6135557777' });
  await env.a.Customer.update(env.john.id, { address: '1 Main St' });
  const stale = await decide(env, A, p.staff.confirmation);
  assert.match(stale.reply, /changed since this preview/);
  const p2 = await turn(env, A, plan(), 'change John Smith phone to 6135557777');
  await decide(env, A, p2.staff.confirmation);
  assert.equal(env.s.tables.Customer.find((c) => c.id === env.john.id).phone, '6135557777');
  const amb = await turn(env, A, { calls: [{ name: 'customers.update', args: { customer: 'John', phone: '6135557777' } }] }, 'change John phone to 6135557777');
  assert.equal(amb.staff.tool_results[0].status, 'needs_input');
  assert.equal(amb.staff.options.length, 2);
});

test('money movement and deletes are refused honestly', async () => {
  const env = await setup();
  const out = await turn(env, A, { calls: [], unsupported: 'payments' }, 'record a $200 payment on INV-1');
  assert.match(out.reply, /never moved from chat/);
  assert.equal((await turn(env, A, { calls: [] }, 'what does a timing belt do')), null);
  assert.match((await turn(env, A, { calls: [] }, 'how many hours for a timing belt')).reply, /^To Look Up Labor Time/);
});

test('source guards: staff tools only in owner mode; browser sends no tenant claims', () => {
  const fn = readFileSync('base44/functions/lbcAutoAI/entry.ts', 'utf8');
  const owner = readFileSync('base44/shared/staffAssistant/ownerRequest.ts', 'utf8');
  assert.match(owner, /if \(mode === 'owner' && !image_base64 && !image_url\)[\s\S]*handleStaffTurn/);
  assert.ok(fn.indexOf('handleOwnerRequest({') < fn.indexOf('PUBLIC MODE'));
  assert.ok(!/shop_context\)/.test(fn));
  const ui = readFileSync('src/components/shared/AutoAIBubble.jsx', 'utf8');
  assert.ok(!/shop_email|shop_context|InvokeLLM/.test(ui));
  assert.match(ui, /staff_action: \{ action_id, token, decision \}/);
});

test('ToolError is exported for the function boundary', () => assert.ok(new ToolError('x', 'y') instanceof Error));