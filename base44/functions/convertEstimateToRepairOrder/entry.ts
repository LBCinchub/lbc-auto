import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && !user.business_name) return Response.json({ error: "Owner access required" }, { status: 403 });
    const { estimate_id } = await req.json();
    const estimate = await base44.asServiceRole.entities.Estimate.get(estimate_id);
    const tenant = String(user.email || "").toLowerCase();
    const owner = String(estimate?.shop_owner_email || estimate?.created_by || "").toLowerCase();
    if (!estimate || (owner ? owner !== tenant : estimate.created_by_id !== user.id)) return Response.json({ error: "Estimate unavailable" }, { status: 404 });
    const existing = await base44.asServiceRole.entities.RepairOrder.filter({ estimate_id: estimate.id }, "-created_date", 10);
    const owned = existing.find((item) => { const value = String(item.shop_owner_email || item.created_by || "").toLowerCase(); return value ? value === tenant : item.created_by_id === user.id; });
    if (owned) {
      await base44.entities.Estimate.update(estimate.id, { linked_repair_order_id: owned.id, linked_repair_order_number: owned.order_number });
      return Response.json({ success: true, reused: true, repair_order: { id: owned.id, order_number: owned.order_number, status: owned.status } });
    }
    const ghostActive = estimate.ghost_status === "active" && (estimate.ghost_items || []).length > 0;
    const roGhostTotal = ghostActive ? r2((estimate.ghost_items || []).reduce((s, x) => s + (Number(x.quantity) || 0) * (Number(x.unit_price) || 0), 0)) : 0;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tenant}:${estimate.id}`));
    const suffix = Array.from(new Uint8Array(digest)).slice(0, 5).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    const order = await base44.entities.RepairOrder.create({ estimate_id: estimate.id, order_number: `RO-${suffix}`, customer_id: estimate.customer_id, customer_name: estimate.customer_name, vehicle_id: estimate.vehicle_id, vehicle_info: estimate.vehicle_info, description: estimate.service_reason || estimate.notes || `Created from estimate #${estimate.estimate_number || ""}`, status: "waiting", labor_hours: (estimate.labor_items || []).reduce((sum, item) => sum + (Number(item.hours) || 0), 0), labor_cost: Number(estimate.labor_total) || 0, labor_items: estimate.labor_items || [], parts_used: (estimate.parts_items || []).map((item) => ({ name: item.name, part_number: item.part_number || "", quantity: Number(item.quantity) || 0, unit_price: Number(item.unit_price) || 0, total: Number(item.total) || 0 })), parts_cost: Number(estimate.parts_total) || 0, total_cost: Number(estimate.grand_total) || 0, notes: estimate.notes || "", ghost_items: ghostActive ? (estimate.ghost_items || []) : [], ghost_status: ghostActive ? "active" : "none", ghost_notes: estimate.ghost_notes || "", ghost_total: roGhostTotal });
    await base44.entities.Estimate.update(estimate.id, { linked_repair_order_id: order.id, linked_repair_order_number: order.order_number, ...(ghostActive ? { ghost_status: "converted", ghost_converted_to: order.id, ghost_converted_type: "RepairOrder", ghost_converted_number: order.order_number } : {}) });
    await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: "link", customer_id: estimate.customer_id, estimate_id: estimate.id, source_type: "estimate", source_id: estimate.id, idempotency_key: `estimate-ro:${estimate.id}`, created_at: new Date().toISOString(), actor_email: tenant, metadata: { repair_order_id: order.id } });
    return Response.json({ success: true, reused: false, repair_order: { id: order.id, order_number: order.order_number, status: order.status } });
  } catch (error) {
    const missing = /not found/i.test(error?.message || "");
    return Response.json({ error: missing ? "Estimate unavailable" : "Conversion unavailable" }, { status: missing ? 404 : 400 });
  }
}