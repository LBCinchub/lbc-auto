import { computeTotals, canonicalTaxTarget, readDiscount, toRepairOrderDiscount, r2 } from "@/lib/financialPolicy";
import { normalizeLaborItems, normalizeParts } from "@/lib/repairOrderSave";

// Tax/discount fields of a saved RO (or prefill) in form shape. Explicit values are kept as-is
// (rate 0, No Tax, none); `missing` lists what the record does not hold so the caller can fall back.
export function roFormPolicy(doc) {
  const target = canonicalTaxTarget(doc);
  const disc = readDiscount(doc);
  const missing = [];
  if (doc?.tax_rate == null) missing.push("tax_rate");
  if (!target) missing.push("tax_applies_to");
  return {
    tax_rate: doc?.tax_rate == null ? null : Number(doc.tax_rate) || 0,
    tax_applies_to: target || "both",
    apply_tax: (target || "both") !== "none",
    ...toRepairOrderDiscount({ type: disc.type ?? "none", value: disc.value }),
    missing,
  };
}

// Fill only fields the RO lacks from its verified source estimate (never written back automatically).
export function fillFromSourceEstimate(policy, estimate) {
  const src = roFormPolicy(estimate);
  const out = { ...policy, missing: [] };
  if (policy.missing.includes("tax_rate")) { if (src.tax_rate != null) out.tax_rate = src.tax_rate; else out.missing.push("tax_rate"); }
  if (policy.missing.includes("tax_applies_to")) {
    if (!src.missing.includes("tax_applies_to")) { out.tax_applies_to = src.tax_applies_to; out.apply_tax = src.apply_tax; } else out.missing.push("tax_applies_to");
  }
  return out;
}

export function roLines(form) {
  return [
    ...normalizeLaborItems(form.labor_items || []).map((l) => ({ type: "labor", quantity: l.hours, unit_price: l.rate })),
    ...normalizeParts(form.parts_used || []).map((p) => ({ type: "part", quantity: p.quantity, unit_price: p.unit_price })),
  ];
}

// The one RO calculation used by display AND save. Document rate wins; shop rate only when the document has none.
export function roTotals(form, shopTaxRate = 0) {
  const t = computeTotals(roLines(form), {
    taxRate: form.tax_rate ?? shopTaxRate,
    taxTarget: canonicalTaxTarget(form) ?? "both",
    discountType: form.discount_type,
    discountValue: form.discount_value,
  });
  const total = form.custom_total ? r2(form.total_cost) : t.total;
  return { ...t, calculatedTotal: t.total, total };
}

export function roSavePolicy(form, totals) {
  return {
    tax_rate: totals.taxRate,
    tax_applies_to: totals.taxTarget,
    apply_tax: totals.taxTarget !== "none",
    tax_amount: totals.tax,
    discount_type: form.discount_type === "percentage" || form.discount_type === "fixed" ? form.discount_type : "none",
    discount_value: form.discount_type === "percentage" || form.discount_type === "fixed" ? Math.max(0, Number(form.discount_value) || 0) : 0,
    custom_total: !!form.custom_total,
    total_cost: totals.total,
  };
}