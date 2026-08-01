export const formatStatus = (value = "") => String(value || "Pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const titleCase = (value = "") => String(value || "Service").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
export const formatMoney = (value) => new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" }).format(Number(value || 0));
export const vehicleName = (v) => v ? [v.year, v.make, v.model].filter(Boolean).join(" ") : "All Vehicles";
export const maskVin = (vin) => vin ? `•••••••••••••${String(vin).slice(-4)}` : "";
export const filterVehicle = (rows, vehicleId) => vehicleId === "all" ? rows : rows.filter((row) => row.vehicle_id === vehicleId);

const eventConfig = {
  order: ["Repair Order", "description", "created_date"], estimate: ["Estimate", "service_reason", "created_date"],
  invoice: ["Invoice", "customer_note", "created_date"], appointment: ["Appointment", "service_type", "date"],
  recommendation: ["Recommendation", "title", "created_date"], diagnostic: ["Diagnostic Scan", "status", "scan_timestamp"],
};
export function buildActivity(data, vehicleId) {
  const groups = [["order", data.orders], ["estimate", data.estimates], ["invoice", data.invoices], ["appointment", data.appointments], ["recommendation", data.recommendations], ["diagnostic", data.diagnostics]];
  return groups.flatMap(([type, rows]) => filterVehicle(rows || [], vehicleId).map((record) => {
    const [label, titleKey, dateKey] = eventConfig[type];
    const amount = type === "invoice" ? record.balance_due : type === "estimate" ? record.grand_total : null;
    const fallback = type === "diagnostic" ? `${record.dtc_codes?.length || 0} diagnostic codes recorded` : `${label} update`;
    return { type, record, label, title: titleCase(record[titleKey] || fallback), date: record[dateKey] || record.created_date, status: record.status || record.auth_status || (record.is_resolved ? "resolved" : "open"), summary: amount != null ? `${formatMoney(amount)}${type === "invoice" ? " balance" : " estimate"}` : record.vehicle_info || "View details" };
  })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}