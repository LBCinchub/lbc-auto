// Resolve the customer / vehicle / record a write targets. Every candidate is tenant-verified; an
// ambiguous or empty match returns a question instead of guessing.
import { ToolError, getOwned, ownedPage } from './scope.ts';
import { textQuery } from './validate.ts';

export class NeedsInput extends Error {
  questions: string[]; options: any[];
  constructor(questions: string[], options: any[] = []) { super(questions.join(' ')); this.questions = questions; this.options = options; }
}
const vLabel = (v: any) => [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
const last4 = (p: any) => String(p || '').replace(/\D/g, '').slice(-4);

// Page context is a HINT only: used when the staff member names nothing, and still ownership-checked.
export function pageHint(path: any) {
  const m = String(path || '').match(/^\/(CustomerProfile|VehicleTimeline|EstimateDetail|RepairOrderDetail|InvoiceDetail)\/([A-Za-z0-9_-]{1,64})$/);
  return m ? { entity: { CustomerProfile: 'Customer', VehicleTimeline: 'Vehicle', EstimateDetail: 'Estimate', RepairOrderDetail: 'RepairOrder', InvoiceDetail: 'Invoice' }[m[1]], id: m[2] } : null;
}

export async function resolveCustomer(ctx: any, a: any) {
  if (a.customer_id) return getOwned(ctx.svc, 'Customer', a.customer_id, ctx.scope, 'Customer');
  if (a.customer) {
    const res = await ownedPage(ctx.svc, 'Customer', ctx.scope, textQuery(['full_name', 'phone', 'email'], a.customer), { limit: 6 });
    if (res.rows.length === 1) return res.rows[0];
    if (!res.rows.length) throw new NeedsInput([`No customer matching "${a.customer}" was found in your shop. Add the customer first, or check the name or phone.`]);
    throw new NeedsInput([`More than one customer matches "${a.customer}". Which one?`], res.rows.map((c: any) => ({ label: `${c.full_name}${last4(c.phone) ? ` (…${last4(c.phone)})` : ''}`, customer_id: c.id })));
  }
  const hint = ctx.page;
  if (hint?.entity === 'Customer') return getOwned(ctx.svc, 'Customer', hint.id, ctx.scope, 'Customer');
  if (hint?.entity === 'Vehicle') { const v = await getOwned(ctx.svc, 'Vehicle', hint.id, ctx.scope, 'Vehicle'); return getOwned(ctx.svc, 'Customer', v.customer_id, ctx.scope, 'Customer'); }
  throw new NeedsInput(['Which customer is this for? Give a name or phone number.']);
}

export async function resolveVehicle(ctx: any, customer: any, a: any) {
  let v: any = null;
  if (a.vehicle_id) v = await getOwned(ctx.svc, 'Vehicle', a.vehicle_id, ctx.scope, 'Vehicle');
  else if (ctx.page?.entity === 'Vehicle' && !a.vehicle) v = await getOwned(ctx.svc, 'Vehicle', ctx.page.id, ctx.scope, 'Vehicle');
  if (v) { if (v.customer_id !== customer.id) throw new ToolError('forbidden', 'That vehicle does not belong to this customer.', 403); return v; }
  const res = await ownedPage(ctx.svc, 'Vehicle', ctx.scope, { customer_id: customer.id }, { limit: 10 });
  const words = String(a.vehicle || '').toLowerCase().split(/\s+/).filter(Boolean);
  const hits = res.rows.filter((x: any) => x.customer_id === customer.id && words.every((w) => `${vLabel(x)} ${x.vin || ''} ${x.license_plate || ''}`.toLowerCase().includes(w)));
  if (hits.length === 1) return hits[0];
  if (!res.rows.length) throw new NeedsInput([`${customer.full_name} has no vehicle on file. Add the vehicle first.`]);
  throw new NeedsInput([`Which of ${customer.full_name}'s vehicles?`], (hits.length ? hits : res.rows).map((x: any) => ({ label: vLabel(x) || 'Vehicle', vehicle_id: x.id })));
}

export async function resolveByNumber(ctx: any, entity: string, field: string, a: any, label: string) {
  if (a.id) return getOwned(ctx.svc, entity, a.id, ctx.scope, label);
  if (a.number) {
    const res = await ownedPage(ctx.svc, entity, ctx.scope, { [field]: String(a.number).toUpperCase() }, { limit: 2 });
    if (res.rows.length === 1) return res.rows[0];
    throw new NeedsInput([res.rows.length ? `More than one ${label} has number ${a.number}. Open it from its page instead.` : `${label} ${a.number} was not found in your shop.`]);
  }
  if (ctx.page?.entity === entity) return getOwned(ctx.svc, entity, ctx.page.id, ctx.scope, label);
  throw new NeedsInput([`Which ${label}? Give its number.`]);
}
export { vLabel };