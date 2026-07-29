import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { PHASE_NOTICE } from "@/lib/alignment/constants";

export default function PhaseGateBanner() {
  return <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
    <div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" /><div><p className="font-bold text-amber-300">Phase 1 Capability Gate</p><p className="text-sm text-amber-100/90 leading-relaxed">{PHASE_NOTICE}</p></div></div>
    <div className="flex items-start gap-2 text-xs text-gray-300"><ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" /><span>LBC Auto does not verify the accuracy of source measurements. Final alignment verification is the responsibility of the performing technician and shop.</span></div>
  </div>;
}