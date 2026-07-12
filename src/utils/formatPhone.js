/**
 * Formats a phone number to 613-672-2727 style.
 * Handles 10-digit numbers and 11-digit with leading 1.
 */
export function formatPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Strip leading 1 if 11 digits
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 1)}-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return phone; // return as-is if not a standard format
}