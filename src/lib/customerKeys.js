// Comparison keys for spotting the same customer twice: phone digits (a leading 1 dropped),
// a lowercased email, a lowercased name with single spaces. Empty when the value isn't usable.
const digits = (value) => String(value || "").replace(/\D/g, "");

export function phoneKey(value) {
  const d = digits(value);
  const local = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  return local.length >= 7 ? local : "";
}

export function emailKey(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : "";
}

export const nameKey = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();