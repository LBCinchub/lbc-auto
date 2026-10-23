import { normalizeDiscountType } from "@/utils/discount";
import { computeTotals, canonicalTaxTarget, canonicalDiscountType, r2 } from "@/lib/financialPolicy";
export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
// Delegates to the shared policy used by the server, RO form and conversion.
// Missing discount type keeps this editor's historical fallback (no discount); missing target -> both.
export function calculateFinancials(draft, amountPaid = 0) {
  const t = computeTotals(draft.line_items || [], {
    taxRate: draft.tax_rate,
    taxTarget: canonicalTaxTarget(draft) ?? "both",
    discountType: canonicalDiscountType(draft.discount_type) ?? normalizeDiscountType(draft.discount_type),
    discountValue: draft.discount,
  });
  const paid = Number(amountPaid) || 0;
  return { labor: t.labor, parts: t.parts, subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total, paid, balance: r2(Math.max(0, t.total - paid)) };
}