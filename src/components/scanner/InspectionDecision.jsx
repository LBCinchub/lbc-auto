import React from "react";
import { CheckCircle2, AlertTriangle, Search, Package } from "lucide-react";

export default function InspectionDecision({ decision }) {
  if (!decision) return null;
  const isProceed = decision.go_no_go === "PROCEED";

  return (
    <div className={`rounded-lg p-4 space-y-3 ${
      isProceed ? "bg-emerald-500/10 border border-emerald-500/40" : "bg-orange-500/10 border border-orange-500/40"
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide">
          {isProceed
            ? <span className="text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> ✅ PROCEED — Inspection Cleared</span>
            : <span className="text-orange-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> ⚠️ FURTHER DIAGNOSIS NEEDED</span>}
        </h3>
        {decision.estimated_total_time != null && (
          <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-full px-2.5 py-0.5">
            ⏱ Total time est: {decision.estimated_total_time} hrs
          </span>
        )}
      </div>
      {decision.go_no_go_reason && <p className="text-gray-200 text-sm">{decision.go_no_go_reason}</p>}

      <div className="grid md:grid-cols-2 gap-4 mt-3">
        {decision.verifications_needed?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-sky-400 font-semibold flex items-center gap-1">
              <Search className="w-3 h-3" /> Verify Before Repairing
            </p>
            <ol className="list-decimal list-inside text-gray-300 text-sm space-y-0.5">
              {decision.verifications_needed.map((v, j) => <li key={j}>{v}</li>)}
            </ol>
          </div>
        )}
        {decision.pre_repair_checklist?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-purple-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Pre-Repair Checklist
            </p>
            <ol className="list-decimal list-inside text-gray-300 text-sm space-y-0.5">
              {decision.pre_repair_checklist.map((c, j) => <li key={j}>{c}</li>)}
            </ol>
          </div>
        )}
        {decision.tools_needed?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-amber-400 font-semibold flex items-center gap-1">
              <Package className="w-3 h-3" /> Tools Needed
            </p>
            <div className="flex flex-wrap gap-1.5">
              {decision.tools_needed.map((t, j) => (
                <span key={j} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>
          </div>
        )}
        {decision.post_repair_steps?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-teal-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Post-Repair Verification
            </p>
            <ol className="list-decimal list-inside text-gray-300 text-sm space-y-0.5">
              {decision.post_repair_steps.map((s, j) => <li key={j}>{s}</li>)}
            </ol>
          </div>
        )}
      </div>

      {decision.live_data_checks?.length > 0 && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-md p-3 mt-2">
          <p className="text-xs uppercase tracking-wide text-sky-400 font-bold mb-2">Live Data — Sensors to Check</p>
          <div className="space-y-2">
            {decision.live_data_checks.map((check, j) => (
              <div key={j} className="bg-gray-800/40 border border-gray-700 rounded-md p-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <span className="text-white text-sm font-semibold">{check.sensor}</span>
                  {check.normal_range && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
                      Normal: {check.normal_range}
                    </span>
                  )}
                </div>
                {check.what_to_look_for && <p className="text-gray-300 text-xs">📋 {check.what_to_look_for}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {decision.safety_warnings?.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mt-2">
          <p className="text-xs uppercase tracking-wide text-red-400 font-bold mb-1">⚠️ Safety Warnings</p>
          <ul className="list-disc list-inside text-red-200 text-sm space-y-0.5">
            {decision.safety_warnings.map((w, j) => <li key={j}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}