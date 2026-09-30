// Pure helpers for the web booking pipeline — no I/O, fully unit-testable.

const enc = new TextEncoder();

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(String(s)));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix = "") {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  const b64 = btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return prefix + b64;
}

export function newCorrelationId() {
  return "wb_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

const NANP = /^[2-9]\d{2}[2-9]\d{6}$/;

/**
 * Canonicalize a phone to E.164. A number with "+" is taken as-is.
 * Local (no country code) forms are ONLY accepted when the caller supplies
 * the shop's explicit country — we never infer a country.
 */
export function canonicalizePhone(raw, country) {
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (s.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? "+" + digits : null;
  if (country === "CA" || country === "US") {
    if (digits.length === 10 && NANP.test(digits)) return "+1" + digits;
    if (digits.length === 11 && digits[0] === "1" && NANP.test(digits.slice(1))) return "+" + digits;
  }
  return null;
}

/** Local alias digits for NANP shops (e.g. 6136722727); null for everyone else. */
export function localAliasFor(e164, country) {
  if ((country === "CA" || country === "US") && /^\+1\d{10}$/.test(e164)) return e164.slice(2);
  return null;
}

/** Route param → candidate lookups. Never assumes a country. */
export function aliasLookupKeys(param) {
  const digits = String(param ?? "").replace(/\D/g, "");
  if (!/^\d{7,15}$/.test(digits)) return null;
  return { e164: "+" + digits, local: digits };
}

export function isValidTimeZone(tz) {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch (_) { return false; }
}

function tzParts(ms, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
}

/**
 * Convert a shop-local wall time to a UTC instant. Returns null for malformed
 * input, impossible calendar dates, or wall times that don't exist (DST gap).
 * Ambiguous fall-back times resolve to the first occurrence.
 */
export function localToUtc(date, time, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
  if (!isValidTimeZone(tz)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let ms = target;
  for (let i = 0; i < 3; i++) {
    const p = tzParts(ms, tz);
    ms += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  // Prefer the earlier instant for ambiguous (fall-back) times.
  const earlier = ms - 3600000;
  const pe = tzParts(earlier, tz);
  if (`${pe.year}-${pe.month}-${pe.day} ${pe.hour}:${pe.minute}` === `${date} ${time}`) ms = earlier;
  const p = tzParts(ms, tz);
  if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` !== `${date} ${time}`) return null;
  return ms;
}

/** Stable hash of the customer-approved draft, used to bind idempotency keys. */
export async function draftHash(tenant, d) {
  const canon = [
    tenant, d.customer_name, d.customer_phone, (d.customer_email || "").toLowerCase(), d.service_type,
    d.preferred_date, d.time_slot, d.vehicle_make.toLowerCase(), d.vehicle_model.toLowerCase(), d.vehicle_year,
    (d.vehicle_plate || "").toUpperCase(), d.notes || "",
  ].join("\u241f");
  return sha256Hex(canon);
}

/** Source status — request received is NEVER reported as a confirmed slot. */
export function requestStatus(apptStatus) {
  switch (apptStatus) {
    case "confirmed": return { request_status: "slot_confirmed", slot_confirmed: true };
    case "in_progress": return { request_status: "in_progress", slot_confirmed: true };
    case "completed": return { request_status: "completed", slot_confirmed: true };
    case "cancelled": return { request_status: "cancelled", slot_confirmed: false };
    default: return { request_status: "request_received", slot_confirmed: false };
  }
}