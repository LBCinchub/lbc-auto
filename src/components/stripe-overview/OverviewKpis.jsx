import React from "react";
import KpiTile from "./KpiTile";
import { money, dayChange, weekday, shortDate } from "@/lib/stripeOverview";

// Revenue today (vs the same weekday last week), today's payment count, and money not yet in the bank.
export default function OverviewKpis({ days, payouts, currency }) {
  const today = days[days.length - 1];
  const lastWeek = days[days.length - 8];
  const revenueNote = today.revenue > 0
    ? [dayChange(today.revenue, lastWeek.revenue).text, `vs last ${weekday(lastWeek.date)}`]
    : ["No payments yet"];
  const payoutNote = payouts.next_arrival
    ? [`Arrives ${shortDate(payouts.next_arrival)}`]
    : [payouts.total > 0 ? "Not in bank yet" : "All paid out"];

  return (
    <>
      <KpiTile area="rev" n={1} label="Revenue today" note={revenueNote} value={money(today.revenue, currency)} />
      <KpiTile area="ord" n={2} label="Payments" note={["Today"]} value={String(today.count)} />
      <KpiTile area="aov" n={3} label="Pending payouts" note={payoutNote} value={money(payouts.total, currency)} />
    </>
  );
}