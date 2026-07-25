import { base44 } from "@/api/base44Client";
import { validateRecord, syncCustomerActivity } from "@/utils/syncCustomerActivity";

async function verifiedOwner() {
  const user = await base44.auth.me();
  if (!user?.email) throw new Error("Shop owner authentication is required.");
  return user;
}

async function validateLinks(customerId, vehicleId, entityType) {
  const validation = await validateRecord({ customerId, vehicleId, entityType });
  if (!validation.ok) throw new Error(validation.errors.join(" "));
}

export async function saveScannerReport({ reportId, data }) {
  const user = await verifiedOwner();
  await validateLinks(data.customer_id, data.vehicle_id, "DiagnosticScan");
  const payload = { ...data, shop_owner_email: user.email };
  return reportId ? base44.entities.DiagnosticScan.update(reportId, payload) : base44.entities.DiagnosticScan.create(payload);
}

export async function saveScannerAiNotes({ reportId, reportData, messages, summary, customerNotes }) {
  const report = await saveScannerReport({ reportId, data: reportData });
  return base44.entities.DiagnosticScan.update(report.id, {
    ai_follow_up: { summary: summary || "", customer_notes: customerNotes || "", messages, saved_at: new Date().toISOString() },
  });
}

export async function createScannerRepairOrder({ reportId, customerId, vehicleId, vehicleInfo, customerName, payload, existingId }) {
  await verifiedOwner();
  await validateLinks(customerId, vehicleId, "RepairOrder");
  const record = existingId
    ? await base44.entities.RepairOrder.update(existingId, payload)
    : await base44.entities.RepairOrder.create({ ...payload, customer_id: customerId, customer_name: customerName, vehicle_id: vehicleId, vehicle_info: vehicleInfo });
  await syncCustomerActivity({ customerId, vehicleId, vehicleInfo, customerName, entityType: "RepairOrder", entityId: record.id });
  if (reportId) await base44.entities.DiagnosticScan.update(reportId, { repair_order_id: record.id });
  return record;
}

export async function createScannerEstimate({ reportId, customerId, vehicleId, vehicleInfo, customerName, payload }) {
  await verifiedOwner();
  await validateLinks(customerId, vehicleId, "Estimate");
  const record = await base44.entities.Estimate.create({ ...payload, customer_id: customerId, customer_name: customerName, vehicle_id: vehicleId, vehicle_info: vehicleInfo });
  await syncCustomerActivity({ customerId, vehicleId, vehicleInfo, customerName, entityType: "Estimate", entityId: record.id });
  if (reportId) await base44.entities.DiagnosticScan.update(reportId, { estimate_id: record.id });
  return record;
}