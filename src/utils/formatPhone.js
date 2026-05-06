/**
 * Formats a phone number to (613) 413-4575 style.
 * Handles 10-digit numbers with or without country code.
 */
export function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Strip leading 1 if 11 digits
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return phone; // return as-is if not a standard 10-digit number
}