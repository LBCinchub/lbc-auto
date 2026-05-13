import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PRESET_GROUPS = [
  { id: "front_brakes", emoji: "🔴", name: "Front Brakes", color: "border-red-500/40 hover:border-red-400", parts: ["Front Left Brake Pad", "Front Right Brake Pad", "Front Left Rotor", "Front Right Rotor"] },
  { id: "rear_brakes", emoji: "🔵", name: "Rear Brakes", color: "border-blue-500/40 hover:border-blue-400", parts: ["Rear Left Brake Pad", "Rear Right Brake Pad", "Rear Left Rotor", "Rear Right Rotor"] },
  { id: "full_brake", emoji: "⚪", name: "Full Brake Job", color: "border-gray-400/40 hover:border-gray-300", parts: ["Front Left Brake Pad", "Front Right Brake Pad", "Front Left Rotor", "Front Right Rotor", "Rear Left Brake Pad", "Rear Right Brake Pad", "Rear Left Rotor", "Rear Right Rotor"] },
  { id: "front_suspension", emoji: "🟡", name: "Front Suspension", color: "border-yellow-500/40 hover:border-yellow-400", parts: ["FL Control Arm", "FR Control Arm", "FL Sway Bar Link", "FR Sway Bar Link"] },
  { id: "wheel_bearings", emoji: "🟢", name: "Wheel Bearings", color: "border-green-500/40 hover:border-green-400", parts: ["FL Wheel Bearing", "FR Wheel Bearing", "RL Wheel Bearing", "RR Wheel Bearing"] },
  { id: "axles", emoji: "🟠", name: "Axles", color: "border-orange-500/40 hover:border-orange-400", parts: ["Front Left Axle (CV Shaft)", "Front Right Axle (CV Shaft)", "Rear Left Axle", "Rear Right Axle"] },
  { id: "cooling", emoji: "🌡️", name: "Cooling System", color: "border-cyan-500/40 hover:border-cyan-400", parts: ["Water Pump", "Thermostat", "Radiator Cap", "Coolant Flush", "Upper Radiator Hose", "Lower Radiator Hose"] },
  { id: "electrical", emoji: "⚡", name: "Electrical / Charging", color: "border-yellow-400/40 hover:border-yellow-300", parts: ["Alternator", "Battery", "Starter Motor", "Serpentine Belt", "Belt Tensioner"] },
  { id: "sensors", emoji: "🔵", name: "Sensors", color: "border-blue-400/40 hover:border-blue-300", parts: ["O2 Sensor Front/Upstream", "O2 Sensor Rear/Downstream", "MAF Sensor", "MAP Sensor", "Crankshaft Position Sensor", "Camshaft Position Sensor", "Throttle Position Sensor", "Coolant Temperature Sensor", "ABS Wheel Speed Sensor FL", "ABS Wheel Speed Sensor FR", "ABS Wheel Speed Sensor RL", "ABS Wheel Speed Sensor RR"] },
  { id: "sway_bar", emoji: "🟣", name: "Sway Bar Links & Bushings", color: "border-purple-500/40 hover:border-purple-400", parts: ["FL Sway Bar Link", "FR Sway Bar Link", "RL Sway Bar Link", "RR Sway Bar Link", "FL Control Arm Bushing", "FR Control Arm Bushing", "RL Control Arm Bushing", "RR Control Arm Bushing", "FL Strut Mount", "FR Strut Mount"] },
  { id: "struts", emoji: "🟤", name: "Struts & Shocks", color: "border-amber-700/40 hover:border-amber-600", parts: ["FL Strut Assembly", "FR Strut Assembly", "RL Shock Absorber", "RR Shock Absorber", "FL Coil Spring", "FR Coil Spring"] },
  { id: "tune_up", emoji: "🔧", name: "Tune Up", color: "border-slate-400/40 hover:border-slate-300", parts: ["Spark Plugs (set of 4)", "Spark Plugs (set of 6)", "Spark Plugs (set of 8)", "Ignition Coils (set)", "Air Filter", "Cabin Air Filter", "PCV Valve"] },
  { id: "oil_change", emoji: "🛢️", name: "Oil Change Kit", color: "border-amber-500/40 hover:border-amber-400", parts: ["Engine Oil (5L)", "Oil Filter", "Drain Plug Washer"] },
  { id: "transmission", emoji: "⚙️", name: "Transmission", color: "border-indigo-500/40 hover:border-indigo-400", parts: ["Transmission Fluid", "Transmission Filter", "Transmission Pan Gasket", "Shift Solenoid"] },
  { id: "steering", emoji: "🔩", name: "Steering", color: "border-teal-500/40 hover:border-teal-400", parts: ["Power Steering Pump", "Tie Rod End FL", "Tie Rod End FR", "Inner Tie Rod FL", "Inner Tie Rod FR", "Rack and Pinion Assembly", "Power Steering Fluid"] },
  { id: "exhaust", emoji: "💨", name: "Exhaust", color: "border-gray-500/40 hover:border-gray-400", parts: ["Catalytic Converter", "Muffler", "Flex Pipe", "Exhaust Gasket", "O2 Sensor Bung"] },
  { id: "timing", emoji: "🧰", name: "Timing", color: "border-rose-500/40 hover:border-rose-400", parts: ["Timing Belt Kit", "Timing Chain Kit", "Timing Belt Tensioner", "Timing Belt Idler Pulley", "Water Pump (timing kit)"] },
];

const STORAGE_KEY = "quickPartGroups_custom";

function loadCustomGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomGroups(groups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

// onAddParts(parts) receives an array of part name strings
export default function QuickPartGroups({ onAddParts, currentParts = [] }) {
  const [open, setOpen] = useState(false);
  const [customGroups, setCustomGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    setCustomGroups(loadCustomGroups());
  }, []);

  const handleAdd = (parts) => {
    onAddParts(parts);
  };

  const handleSaveCustom = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const partNames = (currentParts || []).map(p => p.name || p).filter(Boolean);
    if (partNames.length === 0) return;
    const newGroup = {
      id: `custom_${Date.now()}`,
      emoji: "📦",
      name,
      color: "border-emerald-500/40 hover:border-emerald-400",
      parts: partNames,
    };
    const updated = [...customGroups, newGroup];
    setCustomGroups(updated);
    saveCustomGroups(updated);
    setNewGroupName("");
  };

  const handleDeleteCustom = (id) => {
    const updated = customGroups.filter(g => g.id !== id);
    setCustomGroups(updated);
    saveCustomGroups(updated);
  };

  const allGroups = [...PRESET_GROUPS, ...customGroups];

  return (
    <div className="mb-3">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 hover:border-yellow-500/50 transition-colors group"
      >
        {open ? <ChevronDown className="w-4 h-4 text-yellow-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
        <span className="text-sm font-medium text-white">⚡ Quick Part Groups</span>
        <span className="text-xs text-gray-500 ml-1">({allGroups.length} groups)</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900/70 p-3 space-y-3">
          {/* Scrollable cards row */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {allGroups.map(group => (
              <div key={group.id} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleAdd(group.parts)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg bg-gray-800 border ${group.color} transition-all hover:bg-gray-750 min-w-[90px] max-w-[110px]`}
                  title={`Add: ${group.parts.join(", ")}`}
                >
                  <span className="text-xl leading-none">{group.emoji}</span>
                  <span className="text-xs text-white font-medium text-center leading-tight">{group.name}</span>
                  <span className="text-xs text-gray-500">{group.parts.length} parts</span>
                </button>
                {/* Delete button for custom groups */}
                {group.id.startsWith("custom_") && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(group.id); }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center hover:bg-rose-600 transition-colors z-10"
                    title="Delete group"
                  >
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Save custom group */}
          <div className="flex gap-2 items-center border-t border-gray-800 pt-3">
            <Input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Name your group..."
              className="bg-gray-800 border-gray-700 text-white h-8 text-xs flex-1"
              onKeyDown={e => e.key === "Enter" && handleSaveCustom()}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCustom}
              disabled={!newGroupName.trim() || (currentParts || []).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1 flex-shrink-0"
            >
              <Plus className="w-3 h-3" /> Save as Group
            </Button>
          </div>
          {(currentParts || []).length === 0 && (
            <p className="text-xs text-gray-600 -mt-1">Add parts first to save them as a group</p>
          )}
        </div>
      )}
    </div>
  );
}