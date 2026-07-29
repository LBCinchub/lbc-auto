import React from "react";
import { BarChart3, ClipboardPlus, Crosshair, FileText, LockKeyhole, RefreshCw, Ruler, Settings, SlidersHorizontal, Wrench } from "lucide-react";

const items = [
  ["overview","Alignment Overview",BarChart3], ["start","Start Alignment",ClipboardPlus], ["measurements","Measurements",Crosshair],
  ["report","Reports",FileText], ["machines","Machines",Wrench], ["recovery","Recovery Toolkit",RefreshCw],
  ["calibration","Calibration",SlidersHorizontal], ["retrofit","Retrofit Lab",LockKeyhole,"Roadmap"], ["settings","Settings",Settings],
];
export default function AlignmentWorkspaceNav({ active, onChange }) {
  return <aside className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] rounded-2xl border border-slate-700/70 bg-slate-950 shadow-2xl overflow-hidden">
    <div className="border-b border-slate-800 bg-gradient-to-br from-cyan-500/15 to-blue-600/5 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-400/30"><Ruler className="h-5 w-5 text-cyan-300" /></span><div><h2 className="font-bold text-white">LBC Alignment Brain</h2><p className="text-[11px] text-slate-400">Retrofit-ready alignment workspace</p></div></div></div>
    <nav className="flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-visible">{items.map(([id,label,Icon,badge])=><button key={id} onClick={()=>onChange(id)} className={`flex min-w-fit w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${active===id?"border-cyan-500/30 bg-cyan-500/15 text-cyan-200":"border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0"/><span className="whitespace-nowrap lg:whitespace-normal">{label}</span>{badge&&<span className="ml-auto rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{badge}</span>}</button>)}</nav>
    <div className="hidden lg:block mx-3 mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-relaxed text-amber-200/80">Phase 1 companion tools only. No direct machine, camera, or sensor control.</div>
  </aside>;
}