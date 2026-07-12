import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Wrench } from "lucide-react";
import { getSeverityStyle } from "@/lib/dtcDatabase";

export default function DtcCard({
  codeObj, dtcInfo, loading, laborRate, canCreate, creating,
  onCreateEstimate, onAddToRepairOrder,
}) {
  const { code, type } = codeObj;
  const style = dtcInfo ? getSeverityStyle(dtcInfo.severity) : null;

  return (
    <div className={`bg-gray-800/60 border rounded-lg p-4 ${style ? style.border : "border-gray-700"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-bold text-lg">{code}</span>
          {type && type !== "stored" && (
            <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${
              type === "pending"
                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                : type === "permanent"
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-slate-500/15 text-slate-400 border-slate-500/30"
            }`}>
              {type}
            </span>
          )}
        </div>
        {style && (
          <span className={`text-xs font-bold border rounded-full px-2.5 py-0.5 ${style.badge}`}>
            {style.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Looking up code...
        </div>
      ) : dtcInfo ? (
        <div className="space-y-2 text-sm">
          <p className="text-gray-200 font-medium">{dtcInfo.name}</p>
          <p className="text-xs text-gray-500">System: {dtcInfo.system}</p>

          <div className="border-t border-gray-700 pt-2">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Likely Cause</p>
            <ul className="list-disc list-inside text-gray-300 space-y-0.5">
              {dtcInfo.causes?.map((cause, i) => <li key={i}>{cause}</li>)}
            </ul>
          </div>

          <div className="border-t border-gray-700 pt-2 flex flex-wrap gap-2">
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
              💰 Est. Repair: ${dtcInfo.cost_min} – ${dtcInfo.cost_max}
            </span>
            <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-full px-2.5 py-0.5">
              ⏱ Est. Labor: {dtcInfo.labor_min} – {dtcInfo.labor_max} hrs @ ${laborRate}/hr
            </span>
          </div>

          {canCreate && (
            <div className="border-t border-gray-700 pt-2 flex gap-2">
              <Button
                size="sm"
                onClick={onCreateEstimate}
                disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                {creating === "estimate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Create Estimate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onAddToRepairOrder}
                disabled={creating === "ro"}
                className="border-gray-700 text-gray-300 gap-1"
              >
                {creating === "ro" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                Add to Repair Order
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-xs mt-2">No data available for this code. Use AI Analyze for diagnosis.</p>
      )}
    </div>
  );
}