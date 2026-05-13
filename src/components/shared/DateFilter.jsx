import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const PILLS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

function getDateRange(key) {
  const now = new Date();
  const toStr = (d) => d.toISOString().split("T")[0];
  const today = toStr(now);

  if (key === "today") return { from: today, to: today };
  if (key === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const ys = toStr(y);
    return { from: ys, to: ys };
  }
  if (key === "week") {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toStr(mon), to: toStr(sun) };
  }
  if (key === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toStr(from), to: toStr(to) };
  }
  return null; // "all"
}

// dateField: function (record) => string (ISO date string to compare)
// onChange: function ({ from, to } | null)
export default function DateFilter({ onChange }) {
  const [active, setActive] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const handlePill = (key) => {
    setActive(key);
    setCustomFrom("");
    setCustomTo("");
    onChange(getDateRange(key));
  };

  const handleApply = () => {
    if (!customFrom && !customTo) return;
    setActive("custom");
    onChange({ from: customFrom || null, to: customTo || null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PILLS.map(pill => (
        <button
          key={pill.key}
          type="button"
          onClick={() => handlePill(pill.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            active === pill.key
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-emerald-500/50 hover:text-white"
          }`}
        >
          {pill.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          type="date"
          value={customFrom}
          onChange={e => { setCustomFrom(e.target.value); setActive("custom"); }}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500 h-7"
        />
        <span className="text-gray-600 text-xs">–</span>
        <input
          type="date"
          value={customTo}
          onChange={e => { setCustomTo(e.target.value); setActive("custom"); }}
          className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500 h-7"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleApply}
          disabled={!customFrom && !customTo}
          className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

// Helper: use this in each page to filter records
export function applyDateFilter(records, dateRange, getDateStr) {
  if (!dateRange) return records;
  return records.filter(r => {
    const d = getDateStr(r);
    if (!d) return false;
    const ds = d.split("T")[0];
    if (dateRange.from && ds < dateRange.from) return false;
    if (dateRange.to && ds > dateRange.to) return false;
    return true;
  });
}