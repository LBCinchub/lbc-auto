import React from "react";
import { Car, Gauge, Hash } from "lucide-react";

/**
 * "Vehicle Identified" banner — shown at the top of the scanner after the
 * BLE adapter auto-reads and NHTSA-decodes the VIN on connect.
 */
export default function VehicleIdentifiedBanner({ vehicle }) {
  if (!vehicle) return null;
  const { year, make, model, trim, vin } = vehicle;
  const engine = vehicle.engine || vehicle.engine_type;
  const mileage = vehicle.mileage_km ?? vehicle.mileage;

  return (
    <div className="bg-gradient-to-r from-emerald-500/15 to-teal-500/10 border border-emerald-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <Car className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            Vehicle Identified
          </span>
          <h3 className="text-white font-bold text-lg leading-tight truncate">
            {year || ""} {make || ""} {model || "Unknown Vehicle"}
          </h3>
          {(trim || engine) && (
            <p className="text-gray-400 text-xs truncate">{[trim, engine].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {mileage != null && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold shrink-0">
            <Gauge className="w-4 h-4" />
            {Number(mileage).toLocaleString()} km
          </div>
        )}
      </div>
      {vin && (
        <div className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center gap-1.5">
          <Hash className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">VIN</span>
          <span className="text-teal-400 font-mono text-xs font-bold tracking-wider">{vin}</span>
        </div>
      )}
    </div>
  );
}