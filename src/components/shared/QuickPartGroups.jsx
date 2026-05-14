import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Plus, X, Check } from "lucide-react";
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
  } catch { return []; }
}

function saveCustomGroups(groups) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

// Portal-based floating popover, positioned via getBoundingClientRect
function GroupPopover({ group, anchorRect, onAdd, onClose }) {
  const popoverRef = useRef(null);
  const [visible, setVisible] = useState(false);

  const [checked, setChecked] = useState(() =>
    Object.fromEntries(group.parts.map(p => [p, true]))
  );
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(group.parts.map(p => [p, "1"]))
  );
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(group.parts.map(p => [p, "0.00"]))
  );

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  const selectedCount = group.parts.filter(p => checked[p]).length;

  const handleAdd = () => {
    const parts = group.parts
      .filter(p => checked[p])
      .map(p => ({
        name: p,
        quantity: parseFloat(quantities[p]) || 1,
        unit_price: parseFloat(prices[p]) || 0,
      }));
    if (parts.length === 0) return;
    onAdd(parts);
  };

  const toggleAll = () => {
    const allChecked = group.parts.every(p => checked[p]);
    setChecked(Object.fromEntries(group.parts.map(p => [p, !allChecked])));
  };

  // Position: smart flip — open below if enough space, else open above
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popoverWidth = 320;
  const popoverHeight = 340; // approximate max height
  const gap = 8;

  let left = anchorRect.left;
  if (left + popoverWidth > viewportWidth - 8) {
    left = viewportWidth - popoverWidth - 8;
  }

  const spaceBelow = viewportHeight - anchorRect.bottom;
  const openAbove = spaceBelow < popoverHeight + gap;

  const top = openAbove
    ? anchorRect.top + window.scrollY - popoverHeight - gap
    : anchorRect.bottom + window.scrollY + gap;

  return createPortal(
    <>
      <style>{`
        .qpg-scroll::-webkit-scrollbar { width: 4px; }
        .qpg-scroll::-webkit-scrollbar-track { background: transparent; }
        .qpg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        .qpg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
      `}</style>
      <div
        ref={popoverRef}
        style={{
          position: "absolute",
          top,
          left,
          width: popoverWidth,
          maxHeight: 320,
          zIndex: 9999,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-6px)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        {/* Sticky header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px 12px 0 0" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{group.emoji} {group.name}</span>
          <button onClick={onClose} style={{ color: "#6b7280", cursor: "pointer", background: "none", border: "none", padding: 2 }}>
            <X size={14} />
          </button>
        </div>

        {/* Sticky column headers */}
        <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 48px 68px", gap: 4, padding: "6px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={toggleAll} style={{ textAlign: "left", fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer", background: "none", border: "none" }}>
            Part Name (toggle all)
          </button>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "right" }}>Qty</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", textAlign: "right" }}>Unit $</span>
        </div>

        {/* Scrollable parts list */}
        <div className="qpg-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {group.parts.map(part => (
            <div
              key={part}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 48px 68px",
                gap: 4,
                alignItems: "center",
                padding: "5px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                opacity: checked[part] ? 1 : 0.45,
                transition: "opacity 100ms",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", minWidth: 0 }}>
                <div
                  onClick={() => setChecked(c => ({ ...c, [part]: !c[part] }))}
                  style={{
                    width: 15, height: 15, flexShrink: 0, borderRadius: 4,
                    border: checked[part] ? "none" : "1.5px solid #4b5563",
                    background: checked[part] ? "#0ea5e9" : "#1f2937",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "background 120ms",
                  }}
                >
                  {checked[part] && <Check size={10} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ fontSize: 12, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{part}</span>
              </label>
              <input
                type="number"
                value={quantities[part]}
                onChange={e => setQuantities(q => ({ ...q, [part]: e.target.value }))}
                disabled={!checked[part]}
                min="1"
                step="1"
                style={{
                  width: "100%", textAlign: "right", fontSize: 12, padding: "2px 4px",
                  background: "#1f2937", border: "1px solid #374151", borderRadius: 4,
                  color: "#fff", outline: "none", height: 24,
                }}
              />
              <input
                type="number"
                value={prices[part]}
                onChange={e => setPrices(p => ({ ...p, [part]: e.target.value }))}
                disabled={!checked[part]}
                min="0"
                step="0.01"
                style={{
                  width: "100%", textAlign: "right", fontSize: 12, padding: "2px 4px",
                  background: "#1f2937", border: "1px solid #374151", borderRadius: 4,
                  color: "#fff", outline: "none", height: 24,
                }}
              />
            </div>
          ))}
        </div>

        {/* Sticky footer */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderTop: "1px solid rgba(255,255,255,0.08)", borderRadius: "0 0 12px 12px" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>{selectedCount} of {group.parts.length} selected</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedCount === 0}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 12px", fontSize: 12, fontWeight: 600,
              background: selectedCount === 0 ? "#374151" : "#0ea5e9",
              color: selectedCount === 0 ? "#6b7280" : "#fff",
              border: "none", borderRadius: 6, cursor: selectedCount === 0 ? "not-allowed" : "pointer",
              transition: "background 120ms",
            }}
          >
            <Plus size={12} /> Add Selected ({selectedCount})
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// onAddParts(parts) receives array of { name, quantity, unit_price }
export default function QuickPartGroups({ onAddParts, currentParts = [] }) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null); // { id, rect }
  const [customGroups, setCustomGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const buttonRefs = useRef({});

  useEffect(() => {
    setCustomGroups(loadCustomGroups());
  }, []);

  const allGroups = [...PRESET_GROUPS, ...customGroups];

  const handleGroupClick = useCallback((group) => {
    if (activeGroup?.id === group.id) {
      setActiveGroup(null);
      return;
    }
    const el = buttonRefs.current[group.id];
    const rect = el ? el.getBoundingClientRect() : null;
    setActiveGroup({ id: group.id, group, rect });
  }, [activeGroup]);

  const handleAdd = (parts) => {
    onAddParts(parts);
    setActiveGroup(null);
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
    if (activeGroup?.id === id) setActiveGroup(null);
  };

  return (
    <div className="mb-3">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setActiveGroup(null); }}
        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 hover:border-yellow-500/50 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-yellow-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
        <span className="text-sm font-medium text-white">⚡ Quick Part Groups</span>
        <span className="text-xs text-gray-500 ml-1">({allGroups.length} groups)</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900/70 p-3 space-y-3">
          {/* Scrollable group cards — overflow visible so nothing clips the portal */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allGroups.map(group => (
              <div key={group.id} className="relative flex-shrink-0">
                <button
                  ref={el => { buttonRefs.current[group.id] = el; }}
                  type="button"
                  onClick={() => handleGroupClick(group)}
                  className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg bg-gray-800 border ${group.color} transition-all hover:bg-gray-750 min-w-[90px] max-w-[110px] ${activeGroup?.id === group.id ? "ring-2 ring-sky-500/60" : ""}`}
                  title={`${group.parts.length} parts`}
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

      {/* Portal popover — rendered at document.body, never inside modal scroll */}
      {activeGroup && activeGroup.rect && (
        <GroupPopover
          key={activeGroup.id}
          group={activeGroup.group}
          anchorRect={activeGroup.rect}
          onAdd={handleAdd}
          onClose={() => setActiveGroup(null)}
        />
      )}
    </div>
  );
}