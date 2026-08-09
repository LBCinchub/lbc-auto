// Build the full vehicle display string, e.g. "2019 Honda Civic 1.5L EX".
// Includes engine liters and trim level when available; omits any missing
// parts so the string never shows "null" or trailing/leading spaces.
export function buildVehicleInfo(v) {
  if (!v) return "";
  return [v.year, v.make, v.model, v.engine_liters, v.trim_level || v.trim]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean)
    .join(" ");
}