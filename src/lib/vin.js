// Pure VIN helpers (no network).
// Standard 17-character VIN: digits and A-Z excluding I, O, Q.
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validateVin(vin) {
  const v = (vin || "").trim().toUpperCase();
  if (v.length !== 17) return { ok: false, vin: v, error: "VIN must be exactly 17 characters. You can still enter vehicle details manually." };
  if (!VIN_RE.test(v)) return { ok: false, vin: v, error: "VIN contains invalid characters (I, O and Q are not allowed). You can still enter details manually." };
  return { ok: true, vin: v, error: "" };
}

// Decoder with timeout, cancellation of older requests, and stale-response protection.
// decode(vin) -> { status: "ok"|"invalid"|"not_found"|"timeout"|"network"|"stale", data?, error? }
export function createVinDecoder({ fetchImpl = (...a) => fetch(...a), timeoutMs = 10000 } = {}) {
  let seq = 0;
  let ctrl = null;
  const decode = async (vin) => {
    const check = validateVin(vin);
    if (!check.ok) return { status: "invalid", error: check.error };
    ctrl?.abort();
    const mine = new AbortController();
    ctrl = mine;
    const id = ++seq;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; mine.abort(); }, timeoutMs);
    try {
      const res = await fetchImpl(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${check.vin}?format=json`, { signal: mine.signal });
      if (!res.ok) throw new Error("NHTSA API error");
      const json = await res.json();
      if (id !== seq) return { status: "stale" };
      const data = parseNhtsaResults(json);
      return data ? { status: "ok", data } : { status: "not_found", error: "Invalid VIN — could not decode vehicle info. Enter details manually." };
    } catch {
      if (id !== seq) return { status: "stale" };
      return timedOut
        ? { status: "timeout", error: "VIN lookup timed out. Try again or enter details manually." }
        : { status: "network", error: "Could not reach NHTSA. Check your connection or enter details manually." };
    } finally {
      clearTimeout(timer);
    }
  };
  return { decode, isLatest: (n) => n === seq, cancel: () => ctrl?.abort() };
}

export function parseNhtsaResults(json) {
  const results = json?.Results || [];
  const get = (variable) => {
    const item = results.find((r) => r.Variable === variable);
    return item?.Value && item.Value !== "Not Applicable" && item.Value !== "0" ? item.Value : "";
  };
  const make = get("Make");
  if (!make) return null;
  const engineCylinders = get("Engine Number of Cylinders");
  const displacementL = get("Displacement (L)");
  const engineConfig = get("Engine Configuration");
  const fuelType = get("Fuel Type - Primary");
  const engineParts = [];
  if (engineCylinders) engineParts.push(`${engineCylinders}-cyl`);
  if (displacementL) engineParts.push(`${parseFloat(displacementL).toFixed(1)}L`);
  if (engineConfig) engineParts.push(engineConfig);
  if (fuelType) engineParts.push(fuelType);
  return {
    make, model: get("Model"), year: get("Model Year"),
    engine_type: engineParts.join(" ") || "", trim: get("Trim"),
  };
}