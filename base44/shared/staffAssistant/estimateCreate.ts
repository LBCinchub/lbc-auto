// Real saved estimate from chat. Prices come only from: numbers the staff member typed, the shop's own
// labor rate setting, or the shop's own price library / inventory (shown with their source in the
// preview). Tax comes only from shop settings; a missing tax rate blocks instead of defaulting to 0.
import { ToolError, getOwned, owned } from './scope.ts';
import { mentioned } from './validate.ts';
import { NeedsInput, resolveCustomer, resolveVehicle, vLabel } from './resolve.ts';
import { computeTotals } from '../financialPolicy.ts';
import { withLease } from '../recordLease.ts';
import { verifiedReceipt, receiptCopyText } from '../staffEstimateCore.ts';

const r2 = (v: number) => Math.round(v * 100) / 100;
const $ = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const lc = (s: any) => String(s || '').trim().toLowerCase();

async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const estimateNumberFor = async (tenant: string, actionId: string) => `EST-${(await sha(`${tenant}:staff-ai:${actionId}`)).slice(0, 6).toUpperCase()}`;

async function libraryPrice(ctx: any, line: any) {
  const lib = await ctx.svc.LineItemLibrary.filter({ shop_owner_email: ctx.scope.tenant, type: line.type, item_name: line.name }, '-times_used', 3);
  const hit = lib.find((r: any) => lc(r.shop_owner_email) === ctx.scope.tenant && lc(r.item_name) === lc(line.name) && r.last_unit_price > 0);
  if (hit) return { unit_price: r2(hit.last_unit_price), source: 'Last Used Price (Your Price Library)' };
  if (line.type === 'part') {
    const parts = await ctx.svc.Part.filter({ name: line.name, created_by_id: ctx.scope.userId }, '-created_date', 3);
    const p = parts.find((x: any) => owned(x, ctx.scope) && lc(x.name) === lc(line.name) && x.sale_price > 0);
    if (p) return { unit_price: r2(p.sale_price), source: 'Inventory Sale Price' };
  }
  return null;
}

export const ESTIMATE_CREATE = {
  name: 'estimates.create', module: 'Estimates', kind: 'create', label: 'Create Estimate',
  description: 'Save a new draft estimate. lines: [{type: part|labor, name, quantity (labor = hours), unit_price}]. Only include numbers the staff member actually said.',
  args: { customer: { type: 'string', max: 60, desc: 'name or phone' }, customer_id: { type: 'id' }, vehicle: { type: 'string', max: 60 }, vehicle_id: { type: 'id' }, job: { type: 'string', max: 200 }, lines: { type: 'lines', max: 20, required: true } },
  async prepare(ctx: any, a: any) {
    const customer = await resolveCustomer(ctx, a);
    const vehicle = await resolveVehicle(ctx, customer, a);
    const missing: string[] = [];
    const lines: any[] = [];
    for (const l of a.lines) {
      let quantity = l.quantity, qtyNote = '';
      if (quantity != null && !mentioned(quantity, ctx.userText)) quantity = null;
      if (quantity == null && l.type === 'part') { quantity = 1; qtyNote = ' (Qty 1 Default)'; }
      if (quantity == null || quantity <= 0) { missing.push(`Labor hours for "${l.name}"`); continue; }
      let price = l.unit_price != null && l.unit_price >= 0 && mentioned(l.unit_price, ctx.userText) ? { unit_price: r2(l.unit_price), source: 'You Typed' } : null;
      if (!price && l.type === 'labor' && ctx.scope.laborRate) price = { unit_price: ctx.scope.laborRate, source: 'Shop Labor Rate' };
      if (!price) price = await libraryPrice(ctx, l);
      if (!price) { missing.push(`Price for "${l.name}"`); continue; }
      lines.push({ type: l.type, name: l.name, quantity, unit_price: price.unit_price, source: price.source + qtyNote, taxable: true });
    }
    if (ctx.scope.taxRate == null) missing.push('Shop tax rate (set it in Settings; tax is never guessed)');
    if (!lines.length && !missing.length) missing.push('Parts and labor for the estimate');
    if (missing.length) throw new NeedsInput(missing.map((m) => `Need: ${m}`));
    const t = computeTotals(lines, { taxRate: ctx.scope.taxRate, taxTarget: ctx.scope.taxTarget });
    if (t.total <= 0) throw new ToolError('invalid', 'This estimate totals $0.00. Add prices or quantities first.');
    const params = { customer_id: customer.id, vehicle_id: vehicle.id, customer_name: customer.full_name || '', vehicle_info: vLabel(vehicle), job: a.job || '', lines, tax_rate: ctx.scope.taxRate, tax_applies_to: t.taxTarget, totals: { labor: t.labor, parts: t.parts, tax: t.tax, total: t.total } };
    return {
      title: `Create Estimate For ${params.customer_name}`, params,
      target: { entity: 'Customer', id: customer.id, version: null },
      fields: [
        { label: 'Customer', after: params.customer_name }, { label: 'Vehicle', after: params.vehicle_info },
        ...(params.job ? [{ label: 'Work', after: params.job }] : []),
        ...lines.map((l, i) => ({ label: `${i + 1}. ${l.name}`, after: `${l.quantity}${l.type === 'labor' ? ' hr' : ''} × ${$(l.unit_price)} = ${$(r2(l.quantity * l.unit_price))} · ${l.source}` })),
        { label: `Tax (${params.tax_rate}% On ${t.taxTarget === 'both' ? 'Parts And Labor' : t.taxTarget})`, after: $(t.tax) }, { label: 'Total', after: $(t.total) },
      ],
      impact: ['Saves a Draft estimate in Estimates. Nothing is sent to the customer and nothing is converted to a repair order or invoice.'],
    };
  },
  async execute(ctx: any, action: any) {
    const p = action.params;
    if (p.tax_rate !== ctx.scope.taxRate) throw new ToolError('stale', 'Your shop tax rate changed since this preview. Ask again for a fresh preview.', 409);
    const customer = await getOwned(ctx.svc, 'Customer', p.customer_id, ctx.scope, 'Customer');
    const vehicle = await getOwned(ctx.svc, 'Vehicle', p.vehicle_id, ctx.scope, 'Vehicle');
    if (vehicle.customer_id !== customer.id) throw new ToolError('forbidden', 'That vehicle no longer belongs to this customer.', 403);
    const number = await estimateNumberFor(ctx.scope.tenant, action.id);
    let saved: any = null;
    await withLease(ctx.sr, 'Customer', customer.id, async () => {
      const prior = (await ctx.svc.Estimate.filter({ estimate_number: number, created_by_id: ctx.scope.userId }, '-created_date', 1)).find((e: any) => owned(e, ctx.scope));
      if (prior) { saved = prior; return; }
      const labor = p.lines.filter((l: any) => l.type === 'labor').map((l: any) => ({ description: l.name, details: '', hours: l.quantity, rate: l.unit_price, total: r2(l.quantity * l.unit_price) }));
      const parts = p.lines.filter((l: any) => l.type === 'part').map((l: any) => ({ name: l.name, details: '', part_number: '', quantity: l.quantity, unit_price: l.unit_price, total: r2(l.quantity * l.unit_price) }));
      const created = await ctx.svc.Estimate.create({
        estimate_number: number, customer_id: customer.id, customer_name: customer.full_name || '', vehicle_id: vehicle.id, vehicle_info: vLabel(vehicle),
        labor_items: labor, parts_items: parts, labor_total: p.totals.labor, parts_total: p.totals.parts, tax_amount: p.totals.tax, tax_rate: p.tax_rate, tax_applies_to: p.tax_applies_to,
        discount: 0, discount_type: '$', grand_total: p.totals.total, estimate_date: ctx.today, service_reason: p.job, notes: '', status: 'draft', auth_status: 'none', amount_paid: 0,
      });
      saved = await ctx.svc.Estimate.get(created.id);
    });
    const receipt = verifiedReceipt(saved, saved?.id, { id: ctx.scope.userId, email: ctx.scope.tenant });
    if (!receipt) throw new ToolError('save_unconfirmed', 'The estimate save could not be confirmed. Check Estimates before trying again.', 503);
    return { receipt: { kind: 'estimate', id: receipt.id, number: receipt.estimate_number, label: `Estimate ${receipt.estimate_number}`, total: receipt.total, tax: receipt.tax, open_path: receipt.open_path }, summary: `Saved draft estimate ${receipt.estimate_number} for ${$(receipt.total)} (tax ${$(receipt.tax)}).`, copy_text: receiptCopyText(receipt), refresh: ['estimates', 'customers'] };
  },
};