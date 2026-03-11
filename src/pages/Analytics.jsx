import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { DollarSign, TrendingUp, Wrench, Users } from "lucide-react";
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