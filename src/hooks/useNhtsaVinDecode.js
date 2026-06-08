import { useState } from "react";

/**
 * Calls the free NHTSA VIN decoder API directly from the frontend.
 * Returns { decoding, vinError, decodeVin }
 *
 * decodeVin(vin) resolves with { make, model, year, engine_type } on success,
 * or null on failure (error stored in vinError).
 */
export function useNhtsaVinDecode() {
  const [decoding, setDecoding] = useState(false);
  const [vinError, setVinError] = useState("");

  const decodeVin = async (vin) => {
    setVinError("");
    if (!vin || vin.trim().length < 17) {
      setVinError("VIN must be exactly 17 characters.");
      return null;
    }
    setDecoding(true);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin.trim()}?format=json`
      );
      if (!res.ok) throw new Error("NHTSA API error");
      const json = await res.json();
      const results = json.Results || [];

      const get = (variable) => {
        const item = results.find((r) => r.Variable === variable);
        return item?.Value && item.Value !== "Not Applicable" && item.Value !== "0"
          ? item.Value
          : "";
      };

      const make = get("Make");
      const model = get("Model");
      const year = get("Model Year");
      const engineCylinders = get("Engine Number of Cylinders");
      const displacementL = get("Displacement (L)");
      const fuelType = get("Fuel Type - Primary");
      const engineConfig = get("Engine Configuration");

      if (!make) {
        setVinError("Invalid VIN — could not decode vehicle info.");
        return null;
      }

      // Build a readable engine string
      const engineParts = [];
      if (engineCylinders) engineParts.push(`${engineCylinders}-cyl`);
      if (displacementL) engineParts.push(`${parseFloat(displacementL).toFixed(1)}L`);
      if (engineConfig) engineParts.push(engineConfig);
      if (fuelType) engineParts.push(fuelType);
      const engine_type = engineParts.join(" ") || "";

      return { make, model, year, engine_type };
    } catch (err) {
      setVinError("Could not reach NHTSA. Check your connection.");
      return null;
    } finally {
      setDecoding(false);
    }
  };

  return { decoding, vinError, decodeVin, setVinError };
}