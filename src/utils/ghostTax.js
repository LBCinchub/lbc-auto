// Ghost Mode tax + helpers — shared across Estimate, Invoice, and Repair Order.
// Same tax logic as the main document (financialMath) but with no discount:
// subtotal, taxable base (by tax_applies_to), tax, total.

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function lineTotal(x) {
  return r2((Number(x.quantity) || 0) * (Number(x.unit_price) || 0));
}

export function calcGhostTotals(items, taxRate, taxAppliesTo) {
  const lines = items || [];
  const appliesTo = String(taxAppliesTo || "both").toLowerCase();
  const lineIsTaxable = (x) => {
    if (appliesTo === "none") return false;
    if (appliesTo === "both" || appliesTo === "all") return true;
    if (appliesTo === "labor") return x.type === "labor";
    if (appliesTo === "parts" || appliesTo === "part") return x.type !== "labor";
    return true;
  };
  let subtotal = 0;
  let taxable = 0;
  for (const x of lines) {
    const amt = (Number(x.quantity) || 0) * (Number(x.unit_price) || 0);
    subtotal += amt;
    if (Number(x.quantity) > 0 && x.taxable !== false && lineIsTaxable(x)) taxable += amt;
  }
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  return { subtotal: r2(subtotal), tax: r2(tax), total: r2(subtotal + tax) };
}

// Auto-generated "What's Next" explanation for the ghost section.
export function generateGhostNote(items, taxRate, totals) {
  if (!items || items.length === 0) return "";
  const names = items
    .map((i) => (i.name || i.description || "").trim())
    .filter(Boolean);
  const taxPct = Number(taxRate) || 0;
  const list = names.length ? names.join(", ") : "remaining items";
  return `Remaining work includes: ${list}. Estimated total: $${(totals.total || 0).toFixed(2)}${
    taxPct ? ` (includes ${taxPct}% tax)` : ""
  }. Please schedule your next visit to complete this work.`;
}