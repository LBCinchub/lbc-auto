import { normalizeDiscountType } from "@/utils/discount";
export const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
export function calculateFinancials(draft, amountPaid = 0) {
  const lines = draft.line_items || [];
  const labor = lines.filter(x => x.type === "labor" && Number(x.quantity) > 0).reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0);
  const parts = lines.filter(x => x.type !== "labor" && Number(x.quantity) > 0).reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0);
  const subtotal = labor + parts;
  const type = normalizeDiscountType(draft.discount_type);
  const discount = type === "percent" ? subtotal * (Number(draft.discount) || 0) / 100 : type === "fixed" ? Number(draft.discount) || 0 : 0;
  const taxable = lines.filter(x => Number(x.quantity) > 0 && x.taxable !== false && (draft.tax_applies_to === "both" || x.type === draft.tax_applies_to)).reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0);
  const tax = (draft.tax_applies_to === "both" ? Math.max(0, taxable - discount) : taxable) * (Number(draft.tax_rate) || 0) / 100;
  const total = Math.max(0, subtotal - discount + tax);
  return { labor, parts, subtotal, discount, tax, total, paid: Number(amountPaid) || 0, balance: Math.max(0, total - (Number(amountPaid) || 0)) };
}