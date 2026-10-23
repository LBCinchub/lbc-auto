import { withLease } from './recordLease.ts';
import { estimatePolicyForRepairOrder, taxFlag } from './financialPolicy.ts';

// Explicit allowed-field projections (no private/unknown fields copied); explicit exemptions preserved.
export const estimateLaborToRepairOrder = (items: any[] = []) => (items || []).map((l: any) => ({ description: l.description || '', details: l.details || '', hours: Number(l.hours) || 0, rate: Number(l.rate) || 0, total: Number(l.total) || 0, ...taxFlag(l) }));
export const estimatePartsToRepairOrder = (items: any[] = []) => (items || []).map((p: any) => ({ name: p.name, details: p.details || '', part_number: p.part_number || '', quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, total: Number(p.total) || 0, ...taxFlag(p) }));

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
export class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }

// svc = service-role entities, db = user-scoped entities. Exactly one RO per estimate:
// the estimate's lease serializes converters and the RO lookup is repeated inside it,
// so a crash after create (before link) is recovered by the estimate_id lookup on retry.
export async function convertEstimate({ svc, db, user, estimateId, lease = {} }: any) {
  const tenant = String(user.email || '').toLowerCase();
  const ownedBy = (rec: any) => { const v = String(rec?.shop_owner_email || rec?.created_by || '').toLowerCase(); return v ? v === tenant : rec?.created_by_id === user.id; };
  const estimate = await svc.Estimate.get(estimateId).catch(() => null);
  if (!estimate || !ownedBy(estimate)) throw new HttpError(404, 'Estimate unavailable');

  const findExisting = async () => (await svc.RepairOrder.filter({ estimate_id: estimate.id }, '-created_date', 10)).find(ownedBy) || null;
  const reuse = async (ro: any) => {
    if (estimate.linked_repair_order_id !== ro.id) await db.Estimate.update(estimate.id, { linked_repair_order_id: ro.id, linked_repair_order_number: ro.order_number });
    return { success: true, reused: true, repair_order: { id: ro.id, order_number: ro.order_number, status: ro.status } };
  };
  const early = await findExisting();
  if (early) return reuse(early);

  return withLease(svc, 'Estimate', estimate.id, async () => {
    const existing = await findExisting();
    if (existing) return reuse(existing);
    const current = await svc.Estimate.get(estimate.id);
    const approved = current.status === 'approved' || current.auth_status === 'approved' || current.customer_decision === 'approved';
    if (!approved) throw new HttpError(409, 'Estimate must be approved before conversion');
    const [customer, vehicle] = await Promise.all([svc.Customer.get(current.customer_id).catch(() => null), svc.Vehicle.get(current.vehicle_id).catch(() => null)]);
    if (!customer || !vehicle || !ownedBy(customer) || !ownedBy(vehicle) || vehicle.customer_id !== customer.id) throw new HttpError(409, 'Customer or vehicle does not match this estimate');
    const ghostActive = current.ghost_status === 'active' && (current.ghost_items || []).length > 0;
    const ghostTotal = ghostActive ? r2((current.ghost_items || []).reduce((s: number, x: any) => s + (Number(x.quantity) || 0) * (Number(x.unit_price) || 0), 0)) : 0;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${tenant}:${current.id}`));
    const suffix = Array.from(new Uint8Array(digest)).slice(0, 5).map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    const order = await db.RepairOrder.create({ estimate_id: current.id, order_number: `RO-${suffix}`, customer_id: current.customer_id, customer_name: current.customer_name, vehicle_id: current.vehicle_id, vehicle_info: current.vehicle_info, description: current.service_reason || current.notes || `Created from estimate #${current.estimate_number || ''}`, status: 'waiting', labor_hours: (current.labor_items || []).reduce((sum: number, item: any) => sum + (Number(item.hours) || 0), 0), labor_cost: Number(current.labor_total) || 0, labor_items: estimateLaborToRepairOrder(current.labor_items), parts_used: estimatePartsToRepairOrder(current.parts_items), parts_cost: Number(current.parts_total) || 0, total_cost: Number(current.grand_total) || 0, custom_total: false, ...estimatePolicyForRepairOrder(current), notes: current.notes || '', ghost_items: ghostActive ? current.ghost_items : [], ghost_status: ghostActive ? 'active' : 'none', ghost_notes: current.ghost_notes || '', ghost_total: ghostTotal });
    await db.Estimate.update(current.id, { linked_repair_order_id: order.id, linked_repair_order_number: order.order_number, ...(ghostActive ? { ghost_status: 'converted', ghost_converted_to: order.id, ghost_converted_type: 'RepairOrder', ghost_converted_number: order.order_number } : {}) });
    await svc.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'link', customer_id: current.customer_id, estimate_id: current.id, source_type: 'estimate', source_id: current.id, idempotency_key: `estimate-ro:${current.id}`, created_at: new Date().toISOString(), actor_email: tenant, metadata: { repair_order_id: order.id } });
    return { success: true, reused: false, repair_order: { id: order.id, order_number: order.order_number, status: order.status } };
  }, lease);
}