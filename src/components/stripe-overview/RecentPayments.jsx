import React from "react";
import RecentPaymentRow from "./RecentPaymentRow";

// The latest successful card payments from the last 30 days.
export default function RecentPayments({ items, timeZone }) {
  return (
    <article className="dh2-card dh2-recent" style={{ "--n": 5 }}>
      <div className="dh2-row-sb">
        <p className="dh2-label">Recent payments</p>
        <p className="dh2-label">{items.length === 1 ? "1 payment" : `${items.length} payments`}</p>
      </div>
      {items.length ? (
        <ul className="dh2-list">
          {items.map((p) => <RecentPaymentRow key={p.id} payment={p} timeZone={timeZone} />)}
        </ul>
      ) : (
        <p className="dh2-empty">No successful card payments in the last 30 days.</p>
      )}
    </article>
  );
}