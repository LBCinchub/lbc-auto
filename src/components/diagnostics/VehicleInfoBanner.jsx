import React from "react";
import { Car, Hash, Gauge, Palette, Wrench, FileText } from "lucide-react";

export default function VehicleInfoBanner({ vehicle, customerName }) {
  if (!vehicle) return null;

  const vehicleTitle = `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim();

  const rows = [
    { icon: FileText, label: "VIN", value: vehicle.vin },
    { icon: Hash, label: "Plate", value: vehicle.license_plate },
    { icon: Gauge, label: "Mileage", value: vehicle.mileage != null ? `${vehicle.mileage?.toLocaleString()} km` : null },
    { icon: Wrench, label: "Engine", value: vehicle.engine_type },
    { icon: Palette, label: "Color", value: vehicle.color },
  ].filter(r => r.value);

  return (
    <div className="bg-gradient-to-br from-sky-500/10 to-indigo-500/5 border border-sky-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Car className="w-5 h-5 text-sky-400" />
        <h3 className="text-white font-bold text-base">{vehicleTitle || "Unknown Vehicle"}</h3>
        {customerName && (
          <span className="text-xs text-gray-400 ml-auto">
            {customerName}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
            <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide leading-none">{label}</p>
              <p className="text-gray-200 text-xs font-medium truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}