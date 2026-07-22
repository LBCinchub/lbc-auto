import { base44 } from "@/api/base44Client";

const normalize = (value = "") => value.trim().toLowerCase().replace(/\s+/g, " ");

export async function resolveVehicleId({ customerId, vehicleId, vehicleInfo }) {
  if (vehicleId) {
    const vehicle = await base44.entities.Vehicle.get(vehicleId).catch(() => null);
    if (vehicle?.id && (!vehicle.customer_id || vehicle.customer_id === customerId)) return vehicle.id;
  }
  if (!customerId || !vehicleInfo) return "";
  const vehicles = await base44.entities.Vehicle.filter({ customer_id: customerId });
  const target = normalize(vehicleInfo);
  const match = vehicles.find(v => normalize(`${v.year || ""} ${v.make || ""} ${v.model || ""}`) === target);
  return match?.id || (vehicles.length === 1 ? vehicles[0].id : "");
}

export function invoiceFieldsFromRepairOrder(ro, vehicleId, invoiceNumber) {
  const total = Math.round((Number(ro.total_cost) || 0) * 100) / 100;
  const paid = Math.round((Number(ro.amount_paid) || 0) * 100) / 100;
  return {
    invoice_number: invoiceNumber,
    repair_order_id: ro.id,
    estimate_id: ro.estimate_id || "",
    customer_id: ro.customer_id,
    customer_name: ro.customer_name || "",
    vehicle_id: vehicleId || ro.vehicle_id || "",
    vehicle_info: ro.vehicle_info || "",
    line_items: [
      ...(ro.labor_items || []).map(l => ({ description: l.description || "Labor", type: "labor", quantity: Number(l.hours) || 0, unit_price: Number(l.rate) || 0, total: Number(l.total) || 0 })),
      ...(ro.parts_used || []).map(p => ({ description: p.name || "Part", type: "part", quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, total: Number(p.total) || 0 })),
    ],
    parts_used: ro.parts_used || [],
    labor_total: Number(ro.labor_cost) || 0,
    parts_total: Number(ro.parts_cost) || 0,
    total,
    amount_paid: paid,
    balance_due: Math.max(0, Math.round((total - paid) * 100) / 100),
    service_reason: ro.description || "",
  };
}