import React from "react";

// One KPI tile: label + note on top, the big pixel number below (it scales with the card).
export default function KpiTile({ area, n, label, note, value }) {
  return (
    <article className={`dh2-card dh2-kpi dh2-kpi--${area}`} style={{ "--n": n }}>
      <div className="dh2-row-sb">
        <p className="dh2-label">{label}</p>
        <span className="dh2-pair dh2-caps">
          {note.map((part, i) => <span key={i}>{part}</span>)}
        </span>
      </div>
      <p className="dh2-value">{value}</p>
    </article>
  );
}