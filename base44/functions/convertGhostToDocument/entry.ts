import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function computeTotals(lines, taxRate, taxAppliesTo) {
  const appliesTo = String(taxAppliesTo || "both").toLowerCase();
  const lineIsTaxable = (x) => {
    if (appliesTo === "none") return false;
    if (appliesTo === "both" || appliesTo === "all") return true;
    if (appliesTo === "labor") return x.type === "labor";
    if (appliesTo === "parts" || appliesTo === "part") return x.type !== "labor";
    return true;
  };
  let subtotal = 0, taxable = 0, laborTotal = 0, partsTotal = 0;
  for (const x of (lines || [])) {
    const amt = (Number(x.quantity) || 0) * (Number(x.unit_price) || 0);
    subtotal += amt;
    if (x.type === "labor") laborTotal += amt; else partsTotal += amt;
    if (Number(x.quantity) > 0 && x.taxable !== false && lineIsTaxable(x)) taxable += amt;
  }
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  return { subtotal: r2(subtotal), tax: r2(tax), total: r2(subtotal + tax), labor: r2(laborTotal), parts: r2(partsTotal) };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && !user.business_name) {
      return Response.json({ error: "Owner access required" }, { status: 403 });
    }
    const { source_type, source_id, target_type } = await req.json();
    if (!source_type || !source_id || !target_type) {
      return Response.json({ error: "source_type, source_id, target_type required" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const src = await svc.entities[source_type].get(source_id);
    const tenant = String(user.email || "").toLowerCase();
    const owner = String(src?.shop_owner_email || src?.created_by || "").toLowerCase();
    if (!src || (owner ? owner !== tenant : src.created_by_id !== user.id)) {
      return Response.json({ error: "Source document unavailable" }, { status: 404 });
    }

    const ghostItems = Array.isArray(src.ghost_items) ? src.ghost_items : [];
    if (ghostItems.length === 0) {
      return Response.json({ error: "No ghost items to convert" }, { status: 400 });
    }
    const taxRate = Number(src.tax_rate) || 0;
    const taxAppliesTo = src.tax_applies_to || "both";
    const sourceNumber = src.invoice_number || src.estimate_number || src.order_number || "";

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tenant}:${source_id}:${target_type}`));
    const suffix = Array.from(new Uint8Array(digest)).slice(0, 5).map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();

    let newId, newNumber;

    if (target_type === "Invoice") {
      const t = computeTotals(ghostItems, taxRate, taxAppliesTo);
      const inv = await base44.entities.Invoice.create({
        invoice_number: `INV-${suffix}`,
        customer_id: src.customer_id,
        customer_name: src.customer_name,
        vehicle_id: src.vehicle_id,
        vehicle_info: src.vehicle_info,
        line_items: ghostItems,
        parts_total: t.parts,
        labor_total: t.labor,
        tax_rate: taxRate,
        tax_applies_to: taxAppliesTo,
        tax_amount: t.tax,
        total: t.total,
        amount_paid: 0,
        balance_due: t.total,
        status: "unpaid",
        service_reason: src.ghost_notes || `Remaining work from ${source_type} ${sourceNumber}`,
        ghost_source_id: source_id,
        ghost_source_type: source_type,
        ghost_source_number: sourceNumber,
      });
      newId = inv.id;
      newNumber = inv.invoice_number;
    } else if (target_type === "RepairOrder") {
      const laborItems = ghostItems.filter((i) => i.type === "labor").map((i) => ({
        description: i.name, details: i.description || "",
        hours: Number(i.quantity) || 0, rate: Number(i.unit_price) || 0,
        total: r2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)),
      }));
      const partsUsed = ghostItems.filter((i) => i.type !== "labor").map((i) => ({
        name: i.name, part_number: i.part_number || "",
        quantity: Number(i.quantity) || 0, unit_price: Number(i.unit_price) || 0,
        total: r2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)),
      }));
      const laborCost = laborItems.reduce((s, l) => s + l.total, 0);
      const partsCost = partsUsed.reduce((s, p) => s + p.total, 0);
      const ro = await base44.entities.RepairOrder.create({
        order_number: `RO-${suffix}`,
        estimate_id: source_type === "Estimate" ? source_id : (src.estimate_id || ""),
        customer_id: src.customer_id,
        customer_name: src.customer_name,
        vehicle_id: src.vehicle_id,
        vehicle_info: src.vehicle_info,
        description: src.ghost_notes || `Remaining work from ${source_type} ${sourceNumber}`,
        status: "waiting",
        labor_items: laborItems,
        parts_used: partsUsed,
        labor_cost: r2(laborCost),
        parts_cost: r2(partsCost),
        total_cost: r2(laborCost + partsCost),
        ghost_source_id: source_id,
        ghost_source_type: source_type,
        ghost_source_number: sourceNumber,
      });
      newId = ro.id;
      newNumber = ro.order_number;
    } else {
      return Response.json({ error: "target_type must be Invoice or RepairOrder" }, { status: 400 });
    }

    // Mark the source ghost as converted (user-scoped — owner can update their own).
    await base44.entities[source_type].update(source_id, {
      ghost_status: "converted",
      ghost_converted_to: newId,
      ghost_converted_type: target_type,
      ghost_converted_number: newNumber,
    });

    return Response.json({ success: true, new_id: newId, new_number: newNumber, target_type });
  } catch (error) {
    const notFound = /not found/i.test(error?.message || "");
    return Response.json({ error: notFound ? "Source document unavailable" : (error?.message || "Conversion failed") }, { status: notFound ? 404 : 500 });
  }
}