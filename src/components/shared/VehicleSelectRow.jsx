import React from "react";
import { Plus } from "lucide-react";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";

/**
 * Plain vehicle chooser for the customer/vehicle picker inside editor dialogs.
 * A native select never traps focus, steals keystrokes, or swallows the next
 * click on the form, so typing and "+ Labor"/"+ Part" work right after a pick.
 */
export default function VehicleSelectRow({ id, vehicles = [], value, onChange, onAddNew }) {
  return (
    <div className="mt-2 flex gap-2">
      <select
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-950 px-2 text-sm text-white"
      >
        <option value="" disabled>{vehicles.length ? "Select a vehicle…" : "No vehicles on file"}</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {`${buildVehicleInfo(v)}${v.license_plate ? ` · ${v.license_plate}` : ""}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAddNew}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20"
      >
        <Plus className="h-3 w-3" /> New Vehicle
      </button>
    </div>
  );
}