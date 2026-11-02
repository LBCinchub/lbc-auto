import React from "react";
import { Input } from "@/components/ui/input";

// Keep only digits and one decimal point, so stray keys (like "e") can't garble a qty or price.
const cleanAmount = (raw) => {
  const digits = String(raw).replace(/[^\d.]/g, "");
  const dot = digits.indexOf(".");
  return dot === -1 ? digits : digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/\./g, "");
};

// Qty / rate cell. Every click and every focus selects the whole value, so typing replaces the
// default 0 or 1 (or the old amount) instead of mixing with it. Left to itself, the browser puts
// the cursor where the click landed, and in this right-aligned box a click left of a short value
// lands in front of it: "120" typed into "0" became "1200", and "2" typed into "1" became "21".
export default function LineNumberInput({ value, onChange, className, ariaLabel }) {
  const selectAll = (e) => {
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.select();
  };
  return (
    <Input
      type="text"
      aria-label={ariaLabel}
      inputMode="decimal"
      data-no-capitalize
      value={value ?? ""}
      onChange={(e) => onChange(cleanAmount(e.target.value))}
      onFocus={(e) => e.target.select()}
      onMouseDown={selectAll}
      className={className}
    />
  );
}