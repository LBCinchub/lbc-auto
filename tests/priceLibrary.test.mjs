import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './helpers/fakeShopStore.mjs';
import { handleStaffTurn } from '../base44/shared/staffAssistant/handler.ts';
import { CAPABILITIES } from '../base44/shared/staffAssistant/registry.ts';
import { planSchema, validatePlan } from '../base44/shared/staffAssistant/planner.ts';

const NOW = Date.parse('2026-11-10T16:30:00Z');
const A = { id: 'uA', email: 'a@shop.com', business_name: 'A Shop', subscription_status: 'active', labor_rate: 100, timezone: 'America/Toronto' };

// Raw planner replies captured from the live structured-output model on 2026-11-10 (synthetic prompts,
// no shop records). OLD = the previous schema (args object without properties): args always came back
// empty. NEW = the current pairs schema.
const RAW = {
  old_explicit: { calls: [{ name: 'price_library.search', args: {} }], unsupported: 'none' },
  check_brake_labor_price: { calls: [{ name: 'price_library.search', args: [{ key: 'query', value: 'brake' }, { key: 'type', value: 'labor' }], lines: [] }], unsupported: 'none' },
  price_lib_brake: { calls: [{ name: 'price_library.search', args: [{ key: 'query', value: 'brake' }], lines: [] }], unsupported: 'none' },
  explicit_query: { calls: [{ name: 'price_library.search', args: [{ key: 'query', value: 'brake' }, { key: 'type', value: 'labor' }], lines: [] }], unsupported: 'none' },
  check_price_library: { calls: [{ name: 'price_library.search', args: [], lines: [] }], unsupported: 'none' },
  add_vehicle: { calls: [{ name: 'vehicles.create', args: [{ key: 'customer', value: 'john smith' }, { key: 'year', value: '2015' }, { key: 'make', value: 'honda' }, { key: 'model', value: 'civic' }], lines: [] }], unsupported: 'none' },
  make_estimate: { calls: [{ name: 'estimates.create', args: [{ key: 'customer', value: 'john smith' }, { key: 'job', value: 'front brake pads' }], lines: [{ type: 'part', name: 'front brake pads', quantity: '', unit_price: '' }] }], unsupported: 'none' },
};

async function setup() {
  const s = createStore();
  const svc = s.client('service_1');
  for (const [item_name, type, last_unit_price, shop] of [['Front Brake Labor', 'labor', 120, 'a@shop.com'], ['Brake Pads Front', 'part', 80, 'a@shop.com'], ['Oil Change', 'labor', 60, 'a@shop.com'], ['Brake Labor Other Shop', 'labor', 999, 'b@shop.com']]) {
    await svc.LineItemLibrary.create({ shop_owner_email: shop, item_name, type, last_unit_price, times_used: 3 });
  }
  return { s, svc };
}
const run = async (env, raw, text) => {
  const prompts = [];
  const llm = async (p) => { prompts.push(p); return p.response_json_schema ? structuredClone(raw) : 'composed reply'; };
  const out = await handleStaffTurn({ userDb: env.s.client('uA'), svc: env.svc, user: A, llm, now: NOW, body: { messages: [{ role: 'user', content: text }], page: '/Dashboard' } });
  return { out, prompts };
};

test('planner schema: args are {key,value} pairs from an allowlist; no free-form object the model fills in', () => {
  const sch = planSchema('owner');
  const item = sch.properties.calls.items.properties;
  assert.equal(item.args.type, 'array');
  assert.deepEqual(Object.keys(item.args.items.properties), ['key', 'value']);
  assert.ok(item.args.items.properties.key.enum.includes('query') && item.args.items.properties.key.enum.includes('type'));
  assert.ok(item.name.enum.includes('price_library.search'));
  assert.ok(item.name.enum.every((n) => CAPABILITIES[n]), 'only registered tools');
  assert.equal(item.args.items.properties.key.enum.includes('lines'), false);
  assert.equal(item.lines.items.properties.unit_price.type, 'string', 'blank price stays "not stated", never 0');
});

test('captured planner replies produce validated price-library args', () => {
  assert.deepEqual(validatePlan(RAW.check_brake_labor_price).calls[0].args, { query: 'brake', type: 'labor' });
  assert.deepEqual(validatePlan(RAW.explicit_query).calls[0].args, { query: 'brake', type: 'labor' });
  assert.deepEqual(validatePlan(RAW.price_lib_brake).calls[0].args, { query: 'brake' }, 'no type invented when staff did not say labor/part');
  assert.deepEqual(validatePlan(RAW.old_explicit).calls[0].errors, ['query is required']);
  const junk = validatePlan({ calls: [{ name: 'price_library.search', args: [{ key: 'query', value: 'brake' }, { key: 'shop_owner_email', value: 'b@shop.com' }, { key: 'query', value: 'oil' }, { key: 'type', value: 'refund' }] }, { name: 'invoices.delete', args: [] }] });
  assert.deepEqual(junk.calls[0].args, { query: 'brake' });
  assert.deepEqual(junk.calls[0].errors, ['type must be one of part, labor']);
  assert.deepEqual(junk.dropped, ['invoices.delete']);
});

for (const [key, text, expectItems] of [
  ['check_brake_labor_price', 'check brake labor price', ['Front Brake Labor']],
  ['explicit_query', 'Read only: use price_library.search with args query="brake" and type="labor". Do not change any record or send anything.', ['Front Brake Labor']],
  ['price_lib_brake', 'price lib brake', ['Front Brake Labor', 'Brake Pads Front']],
]) {
  test(`"${text.slice(0, 30)}" runs the real tenant-scoped price library read`, async () => {
    const env = await setup();
    const { out, prompts } = await run(env, RAW[key], text);
    assert.equal(out.reply, 'composed reply');
    assert.equal(out.staff.read_only, true);
    assert.deepEqual(out.staff.tool_results.map((r) => [r.label, r.status, r.count]), [['Shop Price Library', 'ok', expectItems.length]]);
    const data = prompts[1].prompt;
    for (const name of expectItems) assert.ok(data.includes(name));
    assert.ok(!data.includes('Other Shop') && !data.includes('999') && !data.includes('Oil Change'), 'other shop and non-matches never reach the model');
    assert.ok(data.includes('memory, not an approved current price'));
    assert.equal(env.s.tables.Estimate, undefined);
  });
}

test('no item named (or args dropped) asks which item instead of "could not be loaded"', async () => {
  for (const key of ['check_price_library', 'old_explicit']) {
    const env = await setup();
    const { out, prompts } = await run(env, RAW[key], 'check the price library');
    assert.equal(out.reply, 'Which part or labor item should I look up in your Price Library?');
    assert.equal(out.staff.tool_results[0].status, 'needs_input');
    assert.equal(prompts.length, 1, 'no read, no compose');
  }
});

test('write pairs only prepare a confirmation; unstated prices stay empty', async () => {
  const env = await setup();
  await env.s.client('uA').Customer.create({ full_name: 'John Smith', phone: '6135551234' });
  const v = validatePlan(RAW.add_vehicle).calls[0];
  assert.deepEqual(v.args, { customer: 'john smith', year: 2015, make: 'honda', model: 'civic' });
  const e = validatePlan(RAW.make_estimate).calls[0];
  assert.deepEqual(e.args.lines, [{ type: 'part', name: 'front brake pads', quantity: null, unit_price: null }]);
  const { out } = await run(env, RAW.add_vehicle, 'add a 2015 honda civic to john smith');
  assert.notEqual(out.staff.tool_results[0].status, 'ok');
  assert.equal(env.s.tables.Vehicle?.length ?? 0, 0, 'nothing saved before Confirm');
});