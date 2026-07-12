import React from "react";
import { DollarSign, TrendingUp, AlertCircle, Wrench } from "lucide-react";

export default function FinancialSummary({ invoices, orders }) {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const weekStart = new Date(now);
  const dayOfWeek = now.getDay();
  weekStart.setDate(now.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  let todayRevenue = 0;
  let weekRevenue = 0;

  for (const inv of invoices) {
    const history = inv.payment_history || [];
    for (const p of history) {
      const pDate = (p.date || "").split("T")[0];
      if (pDate === today) todayRevenue += parseFloat(p.amount) || 0;
      if (pDate >= weekStartStr && pDate <= today) weekRevenue += parseFloat(p.amount) || 0;
    }
    // Also count amount_paid if paid_date falls in range and no detailed history
    if (history.length === 0 && inv.amount_paid > 0 && inv.paid_date) {
      const pd = inv.paid_date.split("T")[0];
      if (pd === today) todayRevenue += parseFloat(inv.amount_paid) || 0;
      if (pd >= weekStartStr && pd <= today) weekRevenue += parseFloat(inv.amount_paid) || 0;
    }
  }

  const outstanding = invoices
    .filter(inv => (inv.balance_due || 0) > 0 && inv.status !== "paid")
    .reduce((s, inv) => s + (parseFloat(inv.balance_due) || 0), 0);

  const activeROs = orders.filter(o =>
    o.status === "in_progress" || o.status === "waiting" || o.status === "waiting_for_parts"
  ).length;

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
        <p className="text-xs text-gray-500 mt-0.5">Revenue this week</p>
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
        <p className="text-xs text-gray-500 mt-0.5">Repair orders in progress</p>
      </div>
    </div>
  );
}