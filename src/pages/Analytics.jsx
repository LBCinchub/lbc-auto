import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { DollarSign, TrendingUp, Wrench, Users, Banknote, CreditCard } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export default function Analytics() {
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 500),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 500),
  });

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list("-created_date", 50),
  });

  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalLaborRevenue = paidInvoices.reduce((sum, i) => sum + (i.labor_total || 0), 0);
  const totalPartsRevenue = paidInvoices.reduce((sum, i) => sum + (i.parts_total || 0), 0);
  const avgPerJob = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  // Monthly revenue
  const monthlyData = {};
  paidInvoices.forEach(inv => {
    const date = inv.paid_date || inv.created_date?.substring(0, 10);
    if (!date) return;
    const month = date.substring(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { month, revenue: 0, labor: 0, parts: 0 };
    monthlyData[month].revenue += inv.total || 0;
    monthlyData[month].labor += inv.labor_total || 0;
    monthlyData[month].parts += inv.parts_total || 0;
  });
  const monthlyChart = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  // Revenue breakdown
  const revenueBreakdown = [
    { name: "Labor", value: totalLaborRevenue },
    { name: "Parts", value: totalPartsRevenue },
  ].filter(r => r.value > 0);

  // Mechanic productivity
  const mechProductivity = mechanics.map(m => {
    const mechOrders = orders.filter(o => o.mechanic_id === m.id);
    const completed = mechOrders.filter(o => o.status === "completed" || o.status === "delivered").length;
    const hours = mechOrders.reduce((sum, o) => sum + (o.labor_hours || 0), 0);
    const revenue = mechOrders.reduce((sum, o) => sum + (o.labor_cost || 0), 0);
    return { name: m.name, completed, hours, revenue };
  });

  // Daily cash vs card report
  const dailyPayments = {};
  invoices.forEach(inv => {
    const entries = inv.payment_history?.length > 0
      ? inv.payment_history
      : [{ date: inv.paid_date || inv.created_date?.substring(0, 10), amount: inv.total || 0, method: inv.payment_method || "unknown" }];
    entries.forEach(p => {
      const day = (p.date || "").substring(0, 10);
      if (!day) return;
      if (!dailyPayments[day]) dailyPayments[day] = { date: day, cash: 0, card: 0 };
      const method = (p.method || "").toLowerCase();
      if (method === "cash") dailyPayments[day].cash += p.amount || 0;
      else if (method && method !== "unknown") dailyPayments[day].card += p.amount || 0;
    });
  });
  const today = new Date().toISOString().substring(0, 10);
  const todayData = dailyPayments[today] || { cash: 0, card: 0 };
  const dailyChart = Object.values(dailyPayments)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map(d => ({ ...d, total: d.cash + d.card }));

  // Order status
  const statusCounts = [
    { name: "Waiting", value: orders.filter(o => o.status === "waiting").length },
    { name: "In Progress", value: orders.filter(o => o.status === "in_progress").length },
    { name: "Parts Needed", value: orders.filter(o => o.status === "waiting_for_parts").length },
    { name: "Completed", value: orders.filter(o => o.status === "completed").length },
    { name: "Delivered", value: orders.filter(o => o.status === "delivered").length },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Financial overview and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} icon={DollarSign} color="green" />
        <StatCard title="Avg Per Job" value={`$${avgPerJob.toFixed(2)}`} icon={TrendingUp} color="sky" />
        <StatCard title="Total Orders" value={orders.length} icon={Wrench} color="purple" />
        <StatCard title="Mechanics" value={mechanics.length} icon={Users} color="amber" />
      </div>

      {/* Daily Cash vs Card Report */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <h3 className="text-white font-semibold mb-1">Daily Payment Report</h3>
        <p className="text-gray-400 text-xs mb-4">Cash vs Card breakdown per day</p>

        {/* Today's totals */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Cash</p>
              <p className="text-xl font-bold text-emerald-400">${todayData.cash.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Card</p>
              <p className="text-xl font-bold text-sky-400">${todayData.card.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Total</p>
              <p className="text-xl font-bold text-purple-400">${(todayData.cash + todayData.card).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* 14-day bar chart */}
        {dailyChart.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                  formatter={(v) => [`$${v.toFixed(2)}`]}
                />
                <Legend />
                <Bar dataKey="cash" name="Cash" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="card" name="Card" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily table */}
        {dailyChart.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="text-left text-xs text-gray-500 font-medium px-3 py-2">Date</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Cash</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Card</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...dailyChart].reverse().map(d => (
                  <tr key={d.date} className={`border-b border-gray-800/30 ${d.date === today ? "bg-yellow-500/5" : ""}`}>
                    <td className="px-3 py-2 text-gray-300 font-medium">{d.date}{d.date === today ? " 📅" : ""}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">${d.cash.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-sky-400">${d.card.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-white font-semibold">${d.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <h3 className="text-white font-semibold mb-4">Monthly Revenue</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                formatter={(v) => [`$${v.toFixed(2)}`]}
              />
              <Legend />
              <Bar dataKey="labor" name="Labor" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="parts" name="Parts" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-white font-semibold mb-4">Revenue Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenueBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {revenueBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                  formatter={v => `$${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status */}
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-white font-semibold mb-4">Order Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  dataKey="value" labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {statusCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Mechanic Productivity */}
      {mechProductivity.length > 0 && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-white font-semibold mb-4">Mechanic Productivity</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Mechanic</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Completed</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Hours</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mechProductivity.map(m => (
                  <tr key={m.name} className="border-b border-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{m.completed}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{m.hours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-semibold">${m.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}