/**
 * Normalizes discount_type values that exist in the database from various
 * historical formats into one of three canonical values: 'fixed', 'percent', 'none'.
 *
 * Legacy records may have: '$', 'fixed', '%', 'percent', 'none', null, 'null'
 */
export function normalizeDiscountType(type) {
  if (!type || type === 'none' || type === 'null') return 'none';
  if (type === '$' || type === 'fixed') return 'fixed';
  if (type === '%' || type === 'percent') return 'percent';
  return 'none';
}

/**
 * Calculates the discount dollar amount given a discount value, discount_type, and subtotal.
 * All amounts rounded to 2 decimal places.
 */
export function calcDiscountAmount(discount, discountType, subtotal) {
  const normType = normalizeDiscountType(discountType);
  const val = parseFloat(discount) || 0;
  if (normType === 'percent') {
    return Math.round(subtotal * (val / 100) * 100) / 100;
  }
  if (normType === 'fixed') {
    return Math.round(val * 100) / 100;
  }
  return 0;
}