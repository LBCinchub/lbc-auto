import React, { useLayoutEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";

// Auto-growing textarea that starts at one line (matching the input height)
// and expands vertically as the user types, so long descriptions wrap instead
// of being clipped. Box styling mirrors the single-line Input used by Item/Qty/Rate.
export default function LineDescriptionInput({ value, onChange, ariaLabel }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <Textarea
      ref={ref}
      value={value || ""}
      onChange={onChange}
      rows={1}
      aria-label={ariaLabel}
      className="min-h-[36px] resize-none overflow-hidden border-gray-700 bg-gray-950 px-3 py-2 leading-snug text-white"
    />
  );
}