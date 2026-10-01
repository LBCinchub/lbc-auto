import React from "react";
import { DollarSign, TrendingUp, AlertCircle, Wrench } from "lucide-react";
import { collectedRevenue, countActiveOrders } from "@/lib/dashboardMetrics";

export default function FinancialSummary({ invoices, orders }) {
  const { today: todayRevenue, week: weekRevenue, needsReview } = collectedRevenue(invoices);

  const outstanding = invoices
    .filter(inv => (inv.balance_due || 0) > 0 && inv.status !== "paid")
    .reduce((s, inv) => s + (parseFloat(inv.balance_due) || 0), 0);

  const activeROs = countActiveOrders(orders);

  const r2 = (n) => Math.round(n * 100) / 100;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Today's Revenue */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xs text-emerald-400/70 font-medium uppercase tracking-wide">Today</span>
        </div>
        <p className="text-2xl font-bold text-emerald-400">${r2(todayRevenue).toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-0.5">Revenue collected today</p>
      </div>

      {/* Week Revenue */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-xs text-sky-400/70 font-medium uppercase tracking-wide">This Week</span>
        </div>
        <p className="text-2xl font-bold text-sky-400">${r2(weekRevenue).toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-0.5">Collected this week</p>
        {needsReview > 0 && (
          <p className="text-xs text-amber-400/80 mt-1" title="Payments with a missing date or invalid amount are not counted">
            {needsReview} payment{needsReview > 1 ? "s" : ""} need review
          </p>
        )}
      </div>

      {/* Outstanding */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs text-amber-400/70 font-medium uppercase tracking-wide">Outstanding</span>
        </div>
        <p className="text-2xl font-bold text-amber-400">${r2(outstanding).toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-0.5">Unpaid balances</p>
      </div>

      {/* Active ROs */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-violet-400" />
          </div>
          <span className="text-xs text-violet-400/70 font-medium uppercase tracking-wide">Active ROs</span>
        </div>
        <p className="text-2xl font-bold text-violet-400">{activeROs}</p>
        <p className="text-xs text-gray-500 mt-0.5">Waiting, in progress or waiting for parts</p>
      </div>
    </div>
  );
}