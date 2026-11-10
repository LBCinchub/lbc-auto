import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { useLineItemLibrary } from "@/hooks/useLineItemLibrary";
import { useAnchoredPosition } from "@/hooks/useAnchoredPosition";

/**
 * Reusable Item/Name autocomplete for line item rows (Estimate, Invoice,
 * Repair Order, Ghost editor). Shows up to 8 of this shop's previously-used items
 * matching the typed prefix, sorted by times_used then alphabetically. Selecting a
 * suggestion fills the name AND calls onPriceSelect with the last-used unit price.
 *
 * The list floats above the form (portaled into the open dialog, positioned below or
 * above the field depending on room), so tables, scroll areas and footers never clip it.
 * The cursor stays in the field the whole time.
 *
 * Keyboard: ArrowUp/Down to navigate, Enter to select, Escape to close (without
 * closing the dialog). Leaving the field closes the list.
 */
export default function ItemNameAutocomplete({
  value,
  onChange,
  type,
  onPriceSelect,
  className,
  placeholder,
  autoFocus,
  ariaLabel,
}) {
  const { data: library = [] } = useLineItemLibrary();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  // A new line gets the cursor without the browser re-centering the form (that jump moved
  // other fields under the pointer); scroll only as far as needed to show the row.
  useLayoutEffect(() => {
    if (!autoFocus || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    inputRef.current.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

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

  const showList = open && suggestions.length > 0;
  const container = useAnchoredPosition(showList, wrapRef, listRef, [suggestions]);
  const close = () => { setOpen(false); setHighlight(-1); };

  useEffect(() => {
    if (!showList) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) close();
    };
    // Escape closes only the list: caught before the dialog's own Escape handling sees it.
    const onKey = (e) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) { e.stopPropagation(); close(); }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [showList]);

  useEffect(() => {
    if (highlight >= 0) listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const choose = (item) => {
    onChange(item.item_name);
    if (onPriceSelect && item.last_unit_price != null) {
      onPriceSelect(Number(item.last_unit_price) || 0);
    }
    close();
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
    } else if (e.key === "Enter" && showList && highlight >= 0) {
      e.preventDefault();
      choose(suggestions[highlight]);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        ref={inputRef}
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (listRef.current?.contains(e.relatedTarget)) return;
          close();
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={className}
      />
      {showList && container && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          data-lbc-item-suggestions=""
          className="fixed z-50 overflow-y-auto overscroll-contain rounded-md border border-gray-700 bg-gray-800 shadow-lg"
          style={{ top: 0, left: 0, maxHeight: "13rem", pointerEvents: "auto" }}
        >
          {suggestions.map((item, i) => (
            <div
              key={item.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm [@media(pointer:coarse)]:min-h-11 ${
                i === highlight ? "bg-sky-500/20" : "hover:bg-gray-700/50"
              }`}
            >
              <span className="truncate text-white" title={item.item_name}>{item.item_name}</span>
              {item.last_unit_price != null && item.last_unit_price > 0 && (
                <span className="ml-2 flex-shrink-0 text-xs text-gray-400">
                  ${Number(item.last_unit_price).toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>,
        container
      )}
    </div>
  );
}