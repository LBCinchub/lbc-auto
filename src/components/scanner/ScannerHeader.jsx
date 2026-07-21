import React from "react";
import { Hexagon, HelpCircle, Crown } from "lucide-react";

export default function ScannerHeader({ isPro, onHelp }) {
  return (
    <div className="bg-gradient-to-r from-gray-950 via-gray-900 to-black border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Hexagon className="w-8 h-8 text-sky-500" fill="currentColor" fillOpacity={0.15} strokeWidth={1.5} />
          <Hexagon className="w-8 h-8 text-sky-400 absolute inset-0" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">
            LBC AUTO AI SCANNER
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">v2.0 · Professional Edition</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPro && (
          <span className="flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-3 py-1 text-xs font-bold">
            <Crown className="w-3 h-3" /> PRO
          </span>
        )}
        <button
          onClick={onHelp}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}