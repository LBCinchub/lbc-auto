import { base44 } from "@/api/base44Client";

export async function createAlignmentSession(data, file) {
  const user = await base44.auth.me();
  let source_file_url = "";
  if (file) ({ file_url: source_file_url } = await base44.integrations.Core.UploadFile({ file }));
  return base44.entities.AlignmentSession.create({ ...data, source_file_url, shop_owner_email: user.email });
}

export async function saveAlignmentMeasurements(session, rows) {
  const existing = await base44.entities.AlignmentMeasurement.filter({ alignment_session_id: session.id });
  const byKey = new Map(existing.map(item => [`${item.axle}-${item.parameter}-${item.side}`, item]));
  const creates = [], updates = [];
  rows.forEach(row => { const old = byKey.get(`${row.axle}-${row.parameter}-${row.side}`); old ? updates.push({ id: old.id, ...row }) : creates.push({ ...row, alignment_session_id: session.id, shop_owner_email: session.shop_owner_email }); });
  if (creates.length) await base44.entities.AlignmentMeasurement.bulkCreate(creates);
  if (updates.length) await base44.entities.AlignmentMeasurement.bulkUpdate(updates);
  await base44.entities.AlignmentSession.update(session.id, { status: "measurements_entered" });
}

export async function saveAlignmentReport({ session, report, repairOrder }) {
  const matches = await base44.entities.AlignmentReport.filter({ alignment_session_id: session.id }, "-created_date", 1);
  const payload = { ...report, alignment_session_id: session.id, customer_id: session.customer_id, vehicle_id: session.vehicle_id, repair_order_id: repairOrder?.id || session.repair_order_id || "", shop_owner_email: session.shop_owner_email, generated_at: new Date().toISOString(), status: "generated" };
  const saved = matches[0] ? await base44.entities.AlignmentReport.update(matches[0].id, payload) : await base44.entities.AlignmentReport.create(payload);
  await base44.entities.AlignmentSession.update(session.id, { repair_order_id: payload.repair_order_id, status: payload.repair_order_id ? "linked_to_ro" : "report_generated" });
  if (repairOrder) await base44.entities.RepairOrder.update(repairOrder.id, { notes: `${repairOrder.notes || ""}\nAlignment report ${saved.id} linked.`.trim() });
  return saved;
}

export async function registerAlignmentMachine(data) { const user = await base44.auth.me(); return base44.entities.AlignmentMachine.create({ ...data, shop_owner_email: user.email }); }
export async function updateAlignmentMachine(id, data) { return base44.entities.AlignmentMachine.update(id, data); }
export async function deleteAlignmentMachine(id) { return base44.entities.AlignmentMachine.delete(id); }
export async function saveCalibration(data) { const user = await base44.auth.me(); const record = await base44.entities.CalibrationRecord.create({ ...data, shop_owner_email: user.email }); if (data.calibration_date) await base44.entities.AlignmentMachine.update(data.machine_id, { last_calibration_at: data.calibration_date }); return record; }
export async function updateCalibration(id, data) { return base44.entities.CalibrationRecord.update(id, data); }
export async function deleteCalibration(id) { return base44.entities.CalibrationRecord.delete(id); }
export async function createRecoveryCase(data) { const user = await base44.auth.me(); return base44.entities.RecoveryCase.create({ ...data, shop_owner_email: user.email }); }
export async function updateRecoveryCase(id, data) { return base44.entities.RecoveryCase.update(id, data); }
export async function deleteRecoveryCase(id) { return base44.entities.RecoveryCase.delete(id); }