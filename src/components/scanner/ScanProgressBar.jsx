import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Slim progress indicator shown in the header while the background scan runs.
 * Visible across all scanner tabs (rendered in the always-mounted parent).
 */
export default function ScanProgressBar({ scanning, progress, label }) {
  if (!scanning) return null;

  return (
    <div className="bg-gray-900 border border-sky-500/30 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
      <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white font-semibold truncate">{label || "Scanning..."}</span>
          <span className="text-xs text-sky-400 font-mono font-bold shrink-0 ml-2">{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}