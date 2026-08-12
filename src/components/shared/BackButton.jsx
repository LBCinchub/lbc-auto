import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Smart history-aware back button.
 * Goes one step back in browser history; if there's no previous entry
 * (user landed directly via URL), falls back to `fallbackTo`.
 */
export default function BackButton({ fallbackTo = "/", className = "", showLabel = false }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackTo);
  };
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