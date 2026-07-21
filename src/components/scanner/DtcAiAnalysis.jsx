import React from "react";
import { Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DtcAiAnalysis({ analysis, laborRate, loading, onAnalyze, onAdd }) {
  if (loading) return <div className="mt-3 flex items-center gap-2 text-sky-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing vehicle-specific labor and parts…</div>;
  if (!analysis) return <Button size="sm" onClick={onAnalyze} className="mt-3 bg-sky-600 hover:bg-sky-700">Analyze With AI</Button>;
  const low = Number(analysis.estimated_labor_hours_low || 0), high = Number(analysis.estimated_labor_hours_high || low);
  return <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-3">
    <p className="text-sm text-white font-medium">{analysis.plain_english}</p>
    <p className="text-sm text-gray-200"><strong className="text-sky-400">Likely cause:</strong> {analysis.likely_cause}</p>
    <div><p className="text-xs uppercase text-gray-500 mb-1">Diagnostic steps</p><ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">{(analysis.diagnostic_steps || []).map((s,i)=><li key={i}>{s}</li>)}</ol></div>
    <p className="text-sm font-semibold text-white">Labor estimate: {low}–{high} hrs × ${laborRate}/hr = ${(low*laborRate).toFixed(2)}–${(high*laborRate).toFixed(2)} labor</p>
    <div><p className="text-xs uppercase text-gray-500 mb-1">Recommended parts</p>{(analysis.recommended_parts || []).map((p,i)=><div key={i} className="flex justify-between text-sm text-gray-300"><span>{p.name || p}</span><span className="text-amber-400">{p.status || analysis.parts_optional_vs_required?.[i] || "Inspect First"}</span></div>)}</div>
    <p className="text-sm text-gray-300"><strong>Customer explanation:</strong> {analysis.customer_friendly_explanation}</p>
    {analysis.mechanic_notes && <p className="text-xs text-gray-500"><strong>Mechanic notes:</strong> {analysis.mechanic_notes}</p>}
    <Button size="sm" onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700"><Wrench className="w-4 h-4 mr-1" /> Add To Repair Order</Button>
  </div>;
}