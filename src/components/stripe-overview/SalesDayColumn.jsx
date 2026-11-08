import React from "react";
import { money, dayChange, weekday, litTiles } from "@/lib/stripeOverview";

const ROWS = [0, 1, 2, 3, 4, 5];

// One day of the 7-day chart: 6 squares lit from the bottom and a hover-only pointer tag.
export default function SalesDayColumn({ index, day, prev, unit, isToday, currency, onShow }) {
  const lit = litTiles(day.revenue, unit);
  const change = dayChange(day.revenue, prev.revenue);
  const pinRow = Math.max(lit, 1) - 1; // top lit square; the bottom square on a day without sales
  const name = isToday ? "Today" : weekday(day.date);

  return (
    <button
      type="button"
      className={`dh2-col${change.down ? " dh2-col--down" : ""}`}
      style={{ "--c": index }}
      aria-label={`${isToday ? "Today" : weekday(day.date, "long")}, ${money(day.revenue, currency)}, ${change.words}`}
      onPointerEnter={onShow}
      onFocus={onShow}
      onClick={onShow}
    >
      <span className="dh2-stack">
        {ROWS.map((r) => (
          <span key={r} className={`dh2-tile${r < lit ? " dh2-tile--on" : ""}`} style={{ "--r": r }}>
            {r === pinRow && (
              <span className="dh2-pin" aria-hidden="true">
                <span className="dh2-pin-tag">{name} · {change.text}</span>
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="dh2-day" aria-hidden="true">{weekday(day.date).charAt(0)}</span>
    </button>
  );
}