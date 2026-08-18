import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLineItemLibrary } from "@/hooks/useLineItemLibrary";

/**
 * Reusable Item/Name autocomplete for line item rows (Estimate, Invoice,
 * Repair Order). Shows up to 8 previously-used items matching the typed
 * prefix, sorted by times_used then alphabetically. Selecting a suggestion
 * fills the name AND calls onPriceSelect with the last-used unit price.
 *
 * Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close.
 */
export default function ItemNameAutocomplete({
  value,
  onChange,
  type,
  onPriceSelect,
  className,
  placeholder,
}) {
  const { data: library = [] } = useLineItemLibrary();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);

  const suggestions = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return [];
    return library
      .filter(
        (item) =>
          item.type === type &&
          (item.item_name || "").toLowerCase().startsWith(q) &&
          (item.item_name || "").toLowerCase() !== q
      )
      .sort(
        (a, b) =>
          (Number(b.times_used) || 0) - (Number(a.times_used) || 0) ||
          (a.item_name || "").localeCompare(b.item_name || "")
      )
      .slice(0, 8);
  }, [library, type, value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const choose = (item) => {
    onChange(item.item_name);
    if (onPriceSelect && item.last_unit_price != null) {
      onPriceSelect(Number(item.last_unit_price) || 0);
    }
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      choose(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-[200px] max-h-52 overflow-y-auto overscroll-contain rounded-md border border-gray-700 bg-gray-800 shadow-lg" style={{ maxHeight: "13rem" }}>
          {suggestions.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                i === highlight ? "bg-sky-500/20" : "hover:bg-gray-700/50"
              }`}
            >
              <span className="truncate text-white">{item.item_name}</span>
              {item.last_unit_price != null && item.last_unit_price > 0 && (
                <span className="ml-2 flex-shrink-0 text-xs text-gray-400">
                  ${Number(item.last_unit_price).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}