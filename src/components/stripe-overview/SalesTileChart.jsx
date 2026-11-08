import React, { useState } from "react";
import SalesDayColumn from "./SalesDayColumn";
import { money, tileUnit } from "@/lib/stripeOverview";

// Revenue for 7 consecutive calendar days ending today. The header shows the 7-day total,
// or the hovered / tapped / focused day's amount.
export default function SalesTileChart({ days, currency }) {
  const [shown, setShown] = useState(null);
  const week = days.slice(1); // days[0] is the day before, for the first column's change tag
  const unit = tileUnit(Math.max(...week.map((d) => d.revenue)));
  const total = week.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <article className="dh2-card dh2-chart" style={{ "--n": 4 }}>
      <div className="dh2-row-sb">
        <p className="dh2-label">Revenue (7D)</p>
        <span className="dh2-total" aria-live="polite">
          {money(shown === null ? total : week[shown].revenue, currency)}
        </span>
      </div>
      <div
        className="dh2-bars"
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setShown(null); }}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShown(null); }}
      >
        {week.map((day, i) => (
          <SalesDayColumn
            key={day.date}
            index={i}
            day={day}
            prev={days[i]}
            unit={unit}
            isToday={i === week.length - 1}
            currency={currency}
            onShow={() => setShown(i)}
          />
        ))}
      </div>
    </article>
  );
}