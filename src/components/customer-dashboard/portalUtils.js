export const RECORD_CONFIG = {
  order: { label: "Repair Order", view: "home" },
  estimate: { label: "Estimate", view: "billing" },
  invoice: { label: "Invoice", view: "billing" },
  appointment: { label: "Appointment", view: "home" },
  recommendation: { label: "Recommendation", view: "cars" },
  diagnostic: { label: "Diagnostic Scan", view: "cars" },
};

export const vehicleName = (vehicle) => vehicle ? [vehicle.year, vehicle.make, vehicle.model, vehicle.engine_liters, vehicle.trim_level || vehicle.trim].filter(Boolean).join(" ") : "All Vehicles";
export const statusLabel = (value) => String(value || "pending").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const titleCase = (value) => String(value || "Service").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
export const formatMoney = (value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));
export const formatDate = (value) => value ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Date unavailable";
export const timeAgo = (value) => {
  if (!value) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};
export const maskVin = (vin) => vin ? `•••••••••••${String(vin).slice(-6).toUpperCase()}` : "";
export const forVehicle = (rows, vehicleId) => vehicleId === "all" ? rows : rows.filter((row) => row.vehicle_id === vehicleId);

export function nextService(vehicle, recommendations, appointments) {
  const nextAppointment = [...appointments].filter((row) => !["completed", "cancelled"].includes(row.status) && new Date(row.date) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const recommendation = recommendations.find((row) => !row.is_resolved);
  if (nextAppointment) return { label: titleCase(nextAppointment.service_type), date: formatDate(nextAppointment.date) };
  if (recommendation) return { label: recommendation.title, date: statusLabel(recommendation.urgency) };
  if (vehicle?.last_service_date && vehicle?.service_interval_months) {
    const due = new Date(vehicle.last_service_date); due.setMonth(due.getMonth() + Number(vehicle.service_interval_months));
    return { label: "Routine service", date: formatDate(due) };
  }
  return null;
}

export function buildTimeline(data) {
  const entries = [
    ...data.orders.map((record) => ({ type: "order", record, date: record.created_date, title: titleCase(record.description), summary: `Repair order ${record.order_number ? `#${record.order_number}` : "update"}` })),
    ...data.estimates.map((record) => ({ type: "estimate", record, date: record.created_date, title: record.estimate_number ? `Estimate #${record.estimate_number}` : "Estimate", summary: record.service_reason ? titleCase(record.service_reason) : "Service estimate" })),
    ...data.invoices.map((record) => ({ type: "invoice", record, date: record.created_date, title: record.invoice_number ? `Invoice #${record.invoice_number}` : "Invoice", summary: record.balance_due > 0 ? `${formatMoney(record.balance_due)} balance` : "Invoice record" })),
    ...data.appointments.map((record) => ({ type: "appointment", record, date: record.date || record.created_date, title: titleCase(record.service_type), summary: record.time_slot ? `Appointment at ${record.time_slot}` : "Service appointment" })),
    ...data.recommendations.map((record) => ({ type: "recommendation", record, date: record.created_date, title: record.title, summary: record.description || "Shop recommendation" })),
    ...data.diagnostics.map((record) => ({ type: "diagnostic", record, date: record.scan_timestamp || record.created_date, title: "Diagnostic Scan", summary: `${record.dtc_codes?.length || 0} diagnostic code${record.dtc_codes?.length === 1 ? "" : "s"}` })),
  ];
  return entries.filter((entry) => entry.date).sort((a, b) => new Date(b.date) - new Date(a.date));
}