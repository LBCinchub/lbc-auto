// Authoritative Estimate <-> Repair Order <-> Invoice relationship resolution.
// Stored links that point at foreign/mismatched records fail closed; inferred links are only
// used when they are fully consistent (same customer + vehicle + back-reference).
const same = (a: any, b: any) => !a || !b || a === b;

export function consistent(record: any, customerId: string, vehicleId: string) {
  return !!record && record.customer_id === customerId && same(record.vehicle_id, vehicleId);
}

export function assertConsistent(label: string, record: any, customerId: string, vehicleId: string) {
  if (record && !consistent(record, customerId, vehicleId)) throw new Error(`${label} does not match this customer and vehicle`);
}

// Find the estimate's converted RO without trusting it blindly.
// getOwned(entity, id) must throw for foreign records; findOwned(filter) returns owned rows.
export async function resolveEstimateRepairOrder({ estimate, customerId, vehicleId, getOwned, findOwned }: any) {
  if (!estimate) return null;
  if (estimate.linked_repair_order_id) {
    const ro = await getOwned('RepairOrder', estimate.linked_repair_order_id, 'Repair Order');
    if (ro.estimate_id && ro.estimate_id !== estimate.id) throw new Error('Linked Repair Order belongs to a different estimate');
    assertConsistent('Linked Repair Order', ro, customerId, vehicleId);
    return ro;
  }
  const candidates = (await findOwned('RepairOrder', { estimate_id: estimate.id })).filter((ro: any) => consistent(ro, customerId, vehicleId));
  return candidates.length === 1 ? candidates[0] : null;
}

// Missing links to fill in (never overwrites a different existing link).
export function linkPatches({ invoice, estimate, repairOrder }: any) {
  const patches: any = { invoice: {}, estimate: null, repairOrder: null };
  if (!invoice) return patches;
  if (estimate && !invoice.estimate_id) patches.invoice.estimate_id = estimate.id;
  if (repairOrder && !invoice.repair_order_id) patches.invoice.repair_order_id = repairOrder.id;
  if (estimate && !estimate.linked_invoice_id) patches.estimate = { linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number };
  if (estimate && repairOrder && !estimate.linked_repair_order_id) patches.estimate = { ...(patches.estimate || {}), linked_repair_order_id: repairOrder.id, linked_repair_order_number: repairOrder.order_number };
  if (repairOrder && !repairOrder.linked_invoice_id) patches.repairOrder = { linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number };
  return patches;
}