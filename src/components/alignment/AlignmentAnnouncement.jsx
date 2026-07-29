import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Ruler, ShieldAlert } from "lucide-react";
import { PHASE_NOTICE } from "@/lib/alignment/constants";

const KEY = "v20260728_alignment_companion_phase1";
export default function AlignmentAnnouncement() {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(!localStorage.getItem(KEY)); }, []);
  useEffect(() => { if (!open) return; const stop = e => { if (e.key === "Escape") e.preventDefault(); }; window.addEventListener("keydown", stop, true); return () => window.removeEventListener("keydown", stop, true); }, [open]);
  if (!open) return null;
  const close = () => { localStorage.setItem(KEY, "dismissed"); setOpen(false); };
  return <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-2xl border border-sky-500/30 bg-gray-950 p-6 shadow-2xl">
    <Ruler className="w-9 h-9 text-sky-400 mb-3" /><h2 className="text-xl font-bold text-white">LBC Alignment Companion is here</h2><p className="text-gray-300 mt-2">Create before/after reports, import legacy files, register machines, and manage recovery cases.</p>
    <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex gap-2"><ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" /><p className="text-xs text-amber-200">{PHASE_NOTICE}</p></div>
    <Button onClick={close} className="w-full mt-5 bg-sky-600 hover:bg-sky-700">Got it</Button>
  </div></div>;
}