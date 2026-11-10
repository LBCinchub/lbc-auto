import React from "react";
import { ArrowLeft } from "lucide-react";
import { useSmartBack } from "@/components/shared/useSmartBack";

/**
 * Smart history-aware back button.
 * Goes one step back in in-app history; on a direct URL it returns to the
 * remembered origin, or `fallbackTo`.
 */
export default function BackButton({ fallbackTo = "/", className = "", showLabel = false }) {
  const goBack = useSmartBack(fallbackTo);
  return (
    <button
      onClick={goBack}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-700 px-2.5 text-gray-300 transition-colors hover:border-sky-500 hover:text-sky-400 ${className}`}
      title="Back"
      aria-label="Back"
    >
      <ArrowLeft className="h-4 w-4" />
      {showLabel && <span className="text-sm font-medium">Back</span>}
    </button>
  );
}