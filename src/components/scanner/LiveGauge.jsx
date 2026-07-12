import React from "react";

const STATUS_COLORS = {
  normal: { text: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/20" },
  warning: { text: "text-amber-400", bar: "bg-amber-500", bg: "bg-amber-500/5", border: "border-amber-500/20" },
  critical: { text: "text-red-400", bar: "bg-red-500", bg: "bg-red-500/5", border: "border-red-500/20" },
};

export default function LiveGauge({ pid, value, unit, status = "normal" }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.normal;
  const display = value != null ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)) : "—";
  const pct = value != null && pid?.max ? Math.min(100, Math.max(0, (Math.abs(value) / pid.max) * 100)) : 0;

  return (
    <div className={`rounded-lg border p-3 ${colors.bg} ${colors.border} relative overflow-hidden`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{pid?.name || "—"}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-xl font-bold font-mono tabular-nums ${colors.text}`}>{display}</span>
        {unit && <span className="text-xs text-gray-500 font-mono">{unit}</span>}
      </div>
      {/* Bar gauge */}
      <div className="mt-2 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}