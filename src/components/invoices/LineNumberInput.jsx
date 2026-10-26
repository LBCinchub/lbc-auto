import React from "react";
import { Input } from "@/components/ui/input";

// Keep only digits and one decimal point, so stray keys (like "e") can't garble a qty or price.
const cleanAmount = (raw) => {
  const digits = String(raw).replace(/[^\d.]/g, "");
  const dot = digits.indexOf(".");
  return dot === -1 ? digits : digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/\./g, "");
};

// Qty / rate cell. Selects its value on focus, so typing replaces the default 0 or 1
// instead of mixing with it (e.g. "100" typed into "0" no longer becomes "1000").
// The select runs right away, never on a timer, so it can't catch the first typed
// digit ("120" becoming "20"); cancelling mouseup keeps a click from undoing it.
export default function LineNumberInput({ value, onChange, className, ariaLabel }) {
  return (
    <Input
      type="text"
      aria-label={ariaLabel}
      inputMode="decimal"
      data-no-capitalize
      value={value ?? ""}
      onChange={(e) => onChange(cleanAmount(e.target.value))}
      onFocus={(e) => e.target.select()}
      onMouseUp={(e) => e.preventDefault()}
      className={className}
    />
  );
}