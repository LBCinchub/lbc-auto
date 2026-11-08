import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { clockLabel } from "@/lib/stripeOverview";
import StripeOverviewState from "./StripeOverviewState";
import OverviewKpis from "./OverviewKpis";
import SalesTileChart from "./SalesTileChart";
import RecentPayments from "./RecentPayments";
import RevenuePixelLine from "./RevenuePixelLine";
import "./stripeOverview.css";

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const errorText = (e) => e?.response?.data?.error || e?.message || "Could not load your Stripe numbers.";

// Card revenue, pending payouts and recent payments from the shop's own Stripe account.
export default function StripeOverview() {
  // The CRT entrance only plays when the page is actually visible.
  const [enter] = useState(() => document.visibilityState === "visible");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stripe-overview", browserZone],
    queryFn: async () => (await base44.functions.invoke("shopStripeOverview", { time_zone: browserZone })).data,
    staleTime: 60000,
    retry: false,
  });

  if (isLoading) return <StripeOverviewState status="loading" />;
  if (error) return <StripeOverviewState status="error" message={errorText(error)} onRetry={refetch} />;
  if (!data?.connected) return <StripeOverviewState status="disconnected" />;

  const { currency, time_zone: zone } = data;
  const notes = [
    data.truncated && "Totals use your newest 2,000 payments.",
    data.other_currency > 0 && `${data.other_currency} payment(s) in other currencies are not included.`,
  ].filter(Boolean);

  return (
    <section className={`dh2-section${enter ? " dh2-enter" : ""}`}>
      <div className="dh2-wrap">
        <header className="dh2-head">
          <h2 className="dh2-title">Stripe overview</h2>
          <span className="dh2-live">{data.mode === "test" ? "Test data · " : ""}Updated {clockLabel(data.updated_at, zone)}</span>
        </header>
        <div className="dh2-grid">
          <OverviewKpis days={data.days} payouts={data.payouts} currency={currency} />
          <SalesTileChart days={data.days.slice(-8)} currency={currency} />
          <div className="dh2-side">
            <RecentPayments items={data.recent} timeZone={zone} />
            <RevenuePixelLine days={data.days} currency={currency} />
          </div>
        </div>
        {notes.length > 0 && <p className="dh2-note">{notes.join(" ")}</p>}
      </div>
    </section>
  );
}