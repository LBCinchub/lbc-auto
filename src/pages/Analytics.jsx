import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { DollarSign, TrendingUp, Wrench, Users, Banknote, CreditCard, Clock, Printer } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, parseISO, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import StatCard from "../components/dashboard/StatCard";

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const REVENUE_PERIODS = ["Day", "Week", "Month", "Year"];

export default function Analytics() {
  const [revPeriod, setRevPeriod] = useState("Month");

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

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", "all"],
    queryFn: () => base44.entities.TimeEntry.list("-clock_in", 500),
  });

  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalLaborRevenue = paidInvoices.reduce((sum, i) => sum + (i.labor_total || 0), 0);
  const totalPartsRevenue = paidInvoices.reduce((sum, i) => sum + (i.parts_total || 0), 0);
  const avgPerJob = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  const filteredRevenue = useMemo(() => {
    const now = new Date();
    const cutoff = revPeriod === "Day" ? startOfDay(now)
      : revPeriod === "Week" ? startOfWeek(now, { weekStartsOn: 1 })
      : revPeriod === "Month" ? startOfMonth(now)
      : startOfYear(now);
    return paidInvoices
      .filter(i => {
        const d = i.paid_date || i.created_date?.substring(0, 10);
        if (!d) return false;
        try { return isAfter(parseISO(d), cutoff) || parseISO(d).getTime() === cutoff.getTime(); } catch { return false; }
      })
      .reduce((sum, i) => sum + (i.total || 0), 0);
  }, [paidInvoices, revPeriod]);

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

  // Daily cash vs card vs e-transfer report
  const dailyPayments = {};
  invoices.forEach(inv => {
    // Only count paid invoices
    if (inv.status !== "paid") return;
    
    // Get payment date (when it was actually paid)
    const day = inv.paid_date || inv.created_date?.substring(0, 10);
    if (!day) return;
    if (!dailyPayments[day]) dailyPayments[day] = { date: day, cash: 0, card: 0, etransfer: 0 };
    
    // Use the full total for paid invoices
    const amount = inv.total || 0;
    const method = inv.payment_method?.toLowerCase() || "";
    
    // Track by payment method
    if (method === "e-transfer" || method === "etransfer") {
      dailyPayments[day].etransfer += amount;
    } else if (method === "card" || inv.card_last4) {
      dailyPayments[day].card += amount;
    } else if (method === "cash") {
      dailyPayments[day].cash += amount;
    } else {
      // Default to cash if not specified
      dailyPayments[day].cash += amount;
    }
  });
  const today = new Date().toISOString().substring(0, 10);
  const todayData = dailyPayments[today] || { cash: 0, card: 0, etransfer: 0 };
  const dailyChart = Object.values(dailyPayments)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map(d => ({ ...d, total: d.cash + d.card + d.etransfer }));

  // Order status
  const statusCounts = [
    { name: "Waiting", value: orders.filter(o => o.status === "waiting").length },
    { name: "In Progress", value: orders.filter(o => o.status === "in_progress").length },
    { name: "Parts Needed", value: orders.filter(o => o.status === "waiting_for_parts").length },
    { name: "Completed", value: orders.filter(o => o.status === "completed").length },
    { name: "Delivered", value: orders.filter(o => o.status === "delivered").length },
  ].filter(s => s.value > 0);

  // Time tracking per mechanic
  const mechanicHours = mechanics.map(m => {
    const entries = timeEntries.filter(e => e.mechanic_id === m.id && e.duration_minutes);
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const days = [...new Set(entries.map(e => e.date))].length;
    return { name: m.name, hours: parseFloat((totalMinutes / 60).toFixed(1)), days, sessions: entries.length };
  }).filter(m => m.sessions > 0).sort((a, b) => b.hours - a.hours);

  // Daily hours chart (last 14 days)
  const dailyHoursMap = {};
  timeEntries.filter(e => e.duration_minutes).forEach(e => {
    if (!dailyHoursMap[e.date]) dailyHoursMap[e.date] = 0;
    dailyHoursMap[e.date] += e.duration_minutes / 60;
  });
  const dailyHoursChart = Object.entries(dailyHoursMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, hours]) => ({ date, hours: parseFloat(hours.toFixed(1)) }));

  const handlePrintDailyReport = () => {
    const printWindow = window.open('', '_blank');
    const reportData = [...dailyChart].reverse();
    const totalCash = reportData.reduce((sum, d) => sum + d.cash, 0);
    const totalCard = reportData.reduce((sum, d) => sum + d.card, 0);
    const totalEtransfer = reportData.reduce((sum, d) => sum + d.etransfer, 0);
    const reportTotal = totalCash + totalCard + totalEtransfer;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily Revenue Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: white; }
            h1 { text-align: center; color: #333; margin-bottom: 10px; }
            .date { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f5f5f5; padding: 12px; text-align: right; border-bottom: 2px solid #333; font-weight: bold; }
            th:first-child { text-align: left; }
            td { padding: 10px 12px; border-bottom: 1px solid #ddd; text-align: right; }
            td:first-child { text-align: left; }
            tr.today { background: #fffacd; }
            .total-row { font-weight: bold; background: #f5f5f5; border-top: 2px solid #333; }
            .summary { margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #0ea5e9; }
            .summary-item { margin: 5px 0; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Daily Revenue Report</h1>
          <div class="date">Generated: ${new Date().toLocaleDateString('en-CA')}</div>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Cash</th>
                <th>Card</th>
                <th>E-Transfer</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.map(d => `
                <tr class="${d.date === today ? 'today' : ''}">
                  <td>${d.date}${d.date === today ? ' (Today)' : ''}</td>
                  <td>$${d.cash.toFixed(2)}</td>
                  <td>$${d.card.toFixed(2)}</td>
                  <td>$${d.etransfer.toFixed(2)}</td>
                  <td>$${d.total.toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>TOTAL</td>
                <td>$${totalCash.toFixed(2)}</td>
                <td>$${totalCard.toFixed(2)}</td>
                <td>$${totalEtransfer.toFixed(2)}</td>
                <td>$${reportTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item"><span class="label">Total Cash:</span> $${totalCash.toFixed(2)}</div>
            <div class="summary-item"><span class="label">Total Card:</span> $${totalCard.toFixed(2)}</div>
            <div class="summary-item"><span class="label">Total E-Transfer:</span> $${totalEtransfer.toFixed(2)}</div>
            <div class="summary-item"><span class="label">Grand Total:</span> $${reportTotal.toFixed(2)}</div>
            <div class="summary-item"><span class="label">Period:</span> Last 14 days</div>
          </div>

          <script>
            window.print();
            window.onafterprint = () => window.close();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintTodayRevenue = () => {
    const printWindow = window.open('', '_blank');
    const totalCash = todayData.cash;
    const totalCard = todayData.card;
    const totalEtransfer = todayData.etransfer;
    const reportTotal = totalCash + totalCard + totalEtransfer;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>End of Day Revenue Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: white; }
            h1 { text-align: center; color: #333; margin-bottom: 10px; }
            .date { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
            .summary { margin-top: 20px; padding: 20px; background: #f9f9f9; border: 2px solid #333; border-radius: 8px; }
            .summary-item { margin: 15px 0; padding: 10px 0; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
            .summary-item:last-child { border-bottom: none; }
            .label { font-weight: bold; font-size: 14px; }
            .value { font-size: 18px; font-weight: bold; color: #0ea5e9; }
            .total-value { color: #10b981; font-size: 24px; }
            .timestamp { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>End of Day Revenue Report</h1>
          <div class="date">Date: ${today}</div>
          <div class="date">Generated: ${new Date().toLocaleString('en-CA')}</div>
          
          <div class="summary">
            <div class="summary-item">
              <span class="label">Cash Payments:</span>
              <span class="value">$${totalCash.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">Card Payments:</span>
              <span class="value">$${totalCard.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="label">E-Transfer Payments:</span>
              <span class="value">$${totalEtransfer.toFixed(2)}</span>
            </div>
            <div class="summary-item" style="border: none; padding: 15px 0; border-top: 2px solid #333; margin-top: 10px;">
              <span class="label" style="font-size: 16px;">Daily Total Revenue:</span>
              <span class="total-value">$${reportTotal.toFixed(2)}</span>
            </div>
          </div>

          <div class="timestamp">Report generated at end of business day</div>

          <script>
            window.print();
            window.onafterprint = () => window.close();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Financial overview and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clickable Total Revenue card with period toggle */}
        <div className="rounded-xl border border-green-700/30 bg-gradient-to-br from-green-900/30 to-green-950/10 p-4 cursor-pointer select-none"
          onClick={() => setRevPeriod(p => { const i = REVENUE_PERIODS.indexOf(p); return REVENUE_PERIODS[(i + 1) % REVENUE_PERIODS.length]; })}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-medium">Revenue ({revPeriod})</p>
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-400">${filteredRevenue.toFixed(2)}</p>
          <div className="flex gap-1 mt-2">
            {REVENUE_PERIODS.map(p => (
              <span key={p} onClick={e => { e.stopPropagation(); setRevPeriod(p); }}
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                  revPeriod === p ? "bg-green-500/30 text-green-300" : "text-gray-600 hover:text-gray-400"
                }`}>{p}</span>
            ))}
          </div>
        </div>
        <StatCard title="Avg Per Job" value={`$${avgPerJob.toFixed(2)}`} icon={TrendingUp} color="sky" />
        <StatCard title="Total Orders" value={orders.length} icon={Wrench} color="purple" />
        <StatCard title="Mechanics" value={mechanics.length} icon={Users} color="amber" />
      </div>

      {/* Daily Cash vs Card Report */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold mb-1">Daily Payment Report</h3>
            <p className="text-gray-400 text-xs">Cash vs Card breakdown per day</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handlePrintTodayRevenue}
              variant="outline"
              size="sm"
              className="gap-2 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
            >
              <Printer className="w-4 h-4" />
              Print Today's Revenue
            </Button>
            <Button
              onClick={handlePrintDailyReport}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print 14-Day Report
            </Button>
          </div>
        </div>

        {/* Today's totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Cash</p>
              <p className="text-lg font-bold text-emerald-400">${todayData.cash.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Card</p>
              <p className="text-lg font-bold text-sky-400">${todayData.card.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — E-Transfer</p>
              <p className="text-lg font-bold text-orange-400">${todayData.etransfer.toFixed(2)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Total</p>
              <p className="text-lg font-bold text-purple-400">${(todayData.cash + todayData.card + todayData.etransfer).toFixed(2)}</p>
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
                <Bar dataKey="etransfer" name="E-Transfer" fill="#f97316" radius={[4, 4, 0, 0]} />
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
                   <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">E-Transfer</th>
                   <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...dailyChart].reverse().map(d => (
                  <tr key={d.date} className={`border-b border-gray-800/30 ${d.date === today ? "bg-yellow-500/5" : ""}`}>
                    <td className="px-3 py-2 text-gray-300 font-medium">{d.date}{d.date === today ? " 📅" : ""}</td>
                     <td className="px-3 py-2 text-right text-emerald-400">${d.cash.toFixed(2)}</td>
                     <td className="px-3 py-2 text-right text-sky-400">${d.card.toFixed(2)}</td>
                     <td className="px-3 py-2 text-right text-orange-400">${d.etransfer.toFixed(2)}</td>
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

      {/* Time Tracking Analytics */}
      {(mechanicHours.length > 0 || dailyHoursChart.length > 0) && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
          <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-sky-400" /> Employee Time Tracking</h3>
          <p className="text-gray-400 text-xs mb-5">Clock-in hours logged per employee</p>

          {dailyHoursChart.length > 0 && (
            <div className="h-52 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyHoursChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={d => d.slice(5)} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                    formatter={v => [`${v}h`, "Hours Worked"]}
                  />
                  <Bar dataKey="hours" name="Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {mechanicHours.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-2">Employee</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Sessions</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Days Worked</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-2">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {mechanicHours.map(m => (
                  <tr key={m.name} className="border-b border-gray-800/30">
                    <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{m.sessions}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{m.days}</td>
                    <td className="px-4 py-3 text-right text-purple-400 font-semibold">{m.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}