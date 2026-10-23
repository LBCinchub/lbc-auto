// Single whitelisted vehicle presentation. Only listed fields are ever read/emitted.
const s = (v) => (v == null ? "" : String(v).trim());
const LITERS_RE = /(\d{1,2}\.\d)\s*L\b/gi;

export function normalizeLiters(v) {
  const t = s(v).replace(/\s*l(iters?)?$/i, "");
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}L` : "";
}

// Explicit field wins; otherwise one unambiguous literal like "2.0L" in engine_type.
export function resolveEngine(v = {}) {
  const type = s(v.engine_type);
  const explicit = normalizeLiters(v.engine_liters);
  const found = [...new Set([...type.matchAll(LITERS_RE)].map((m) => normalizeLiters(m[1])))];
  const embedded = found.length === 1 ? found[0] : "";
  const liters = explicit || embedded;
  const conflict = !!(explicit && found.length && !found.includes(explicit)) || found.length > 1;
  const typeRest = liters ? type.replace(LITERS_RE, "").replace(/\s{2,}/g, " ").trim() : type;
  const combined = [liters, typeRest].filter(Boolean).join(" ");
  return { liters, type: typeRest, combined, conflict, embeddedValues: found };
}

export function formatOdometer(v = {}) {
  if (v.mileage === null || v.mileage === undefined || v.mileage === "") return "";
  const n = Number(v.mileage);
  if (!Number.isFinite(n)) return "";
  const unit = s(v.odometer_unit).toLowerCase();
  return `${n.toLocaleString()} ${unit === "km" || unit === "mi" ? unit : "(Unit Not Recorded)"}`;
}

export function vehicleIdentity(v) {
  if (!v) return "";
  return [v.year, v.make, v.model, v.trim_level || v.trim].map(s).filter(Boolean).join(" ");
}

export function maskVin(vin) { const t = s(vin); return t.length > 4 ? `•••${t.slice(-4)}` : t; }

// Full details list. `NR` marks genuinely unrecorded fields.
export function vehicleDetailRows(v, { maskVinValue = false } = {}) {
  if (!v) return [];
  const e = resolveEngine(v);
  const fuel = s(v.fuel_type);
  const isEv = /^electric$/i.test(fuel);
  const NR = "Not Recorded";
  const vin = s(v.vin);
  return [
    ["Year", s(v.year) || NR], ["Make", s(v.make) || NR], ["Model", s(v.model) || NR],
    ["Trim", s(v.trim_level || v.trim) || NR],
    ["Engine Displacement", e.liters || (isEv ? "Not Applicable" : NR)],
    ["Engine Type", e.type || (isEv ? "Not Applicable" : NR)],
    ["Fuel", fuel || NR], ["Transmission", s(v.transmission) || NR], ["Drivetrain", s(v.drive_type) || NR],
    ["Odometer", formatOdometer(v) || NR],
    ["VIN", vin ? (maskVinValue ? maskVin(vin) : vin) : NR],
    ["Plate", s(v.license_plate) || NR], ["Color", s(v.color) || NR],
    ...(e.conflict ? [["Engine Note", `Conflicting displacement recorded (${[e.liters, ...e.embeddedValues].filter((x, i, a) => a.indexOf(x) === i).join(" vs ")})`]] : []),
  ];
}

export function engineSummary(v) {
  if (!v) return "";
  return [resolveEngine(v).combined, s(v.fuel_type)].filter(Boolean).join(" · ");
}