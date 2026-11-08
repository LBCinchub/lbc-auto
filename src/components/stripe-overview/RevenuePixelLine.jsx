import React, { useId, useMemo } from "react";
import { money, pixelLine, shortDate } from "@/lib/stripeOverview";

// Whole cells masked out in each corner (card colour) so the grid reads as a rounded rectangle.
const CORNERS = [[0, 0, 14, 7], [0, 7, 7, 7], [315, 0, 14, 7], [322, 7, 7, 7], [0, 112, 14, 7], [0, 105, 7, 7], [315, 112, 14, 7], [322, 105, 7, 7]];

// Total revenue for the last 30 calendar days, with daily revenue drawn as a pixel line.
export default function RevenuePixelLine({ days, currency }) {
  const cellId = `dh2-cell-${useId().replace(/:/g, "")}`;
  const cells = useMemo(() => pixelLine(days.map((d) => d.revenue)), [days]);
  const total = days.reduce((sum, d) => sum + d.revenue, 0);
  const count = days.reduce((sum, d) => sum + d.count, 0);
  const best = days.reduce((a, d) => (d.revenue > a.revenue ? d : a), days[0]);
  const label = total > 0
    ? `Revenue over the last 30 days: ${money(total, currency)} in total, best day ${shortDate(best.date)} at ${money(best.revenue, currency)}`
    : "No card revenue in the last 30 days";

  return (
    <article className="dh2-card dh2-trend" style={{ "--n": 6 }}>
      <div className="dh2-row-sb">
        <p className="dh2-label">Total revenue (30D)</p>
        <span className="dh2-pair dh2-caps"><span>{money(total, currency)}</span><span>{count === 1 ? "1 payment" : `${count} payments`}</span></span>
      </div>
      <div className="dh2-plot" role="img" aria-label={label}>
        <svg className="dh2-pix" viewBox="0 0 329 119" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id={cellId} width="7" height="7" patternUnits="userSpaceOnUse">
              <rect x="0.5" y="0.5" width="6" height="6" rx="1" style={{ fill: "var(--dh2-dim)" }} />
            </pattern>
          </defs>
          <rect width="329" height="119" style={{ fill: "var(--dh2-panel)" }} />
          <rect width="329" height="119" fill={`url(#${cellId})`} />
          <g style={{ fill: "var(--dh2-card)" }}>
            {CORNERS.map(([x, y, w, h]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} />)}
          </g>
          <g className="dh2-pix-line">
            {cells.map((c) => (
              <rect key={`${c.col}-${c.row}`} x={c.col * 7 + 0.5} y={c.row * 7 + 0.5} width="6" height="6" rx="1" style={{ animationDelay: `${c.col * 40}ms` }} />
            ))}
          </g>
        </svg>
      </div>
    </article>
  );
}