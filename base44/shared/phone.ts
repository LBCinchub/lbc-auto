// Twilio expects E.164 (+16135551234). Bare 10-digit North American numbers get +1.
export function toE164(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

// MMS (picture/PDF texts) through Twilio is only offered to US/Canada (+1) numbers.
export const isNanpMobileFormat = (e164) => /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(String(e164 || ""));

export const maskPhone = (e164) => {
  const d = String(e164 || "").replace(/\D/g, "");
  return d.length >= 4 ? `•••-•••-${d.slice(-4)}` : "";
};