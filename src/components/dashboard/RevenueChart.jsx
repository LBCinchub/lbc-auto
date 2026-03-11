import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function RevenueChart({ invoices }) {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayInvoices = invoices.filter(inv => inv.paid_date === dateStr || (inv.status === "paid" && inv.created_date?.startsWith(dateStr)));
    const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    last7Days.push({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      revenue,
    });
  }

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
      <h3 className="text-white font-semibold mb-4">Revenue (Last 7 Days)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={last7Days}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
              formatter={(value) => [`$${value.toFixed(2)}`, "Revenue"]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revenueGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}