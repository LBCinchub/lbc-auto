import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { DollarSign, TrendingUp, Wrench, Users, Banknote, CreditCard, Clock, Printer, FileText, X, Plus, Trash2 } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, parseISO, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";
import StatCard from "../components/dashboard/StatCard";

const COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const REVENUE_PERIODS = ["Day", "Week", "Month", "Year", "Custom"];

export default function Analytics() {
  const [revPeriod, setRevPeriod] = useState("Month");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("insights");
  const [filterMechanic, setFilterMechanic] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [paymentMethodModal, setPaymentMethodModal] = useState(null); // "cash" | "card" | "etransfer" | null
  const [expenseForm, setExpenseForm] = useState({ category: "supplies", description: "", amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  const [savingExpense, setSavingExpense] = useState(false);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => base44.entities.Invoice.filter({ created_by: user.email }, "-created_date", 500),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15000, // poll every 15s as safety net
  });

  // Real-time: refetch invoices immediately whenever any invoice is created/updated/deleted
  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Invoice.subscribe(() => {
      refetchInvoices();
    });
    return unsubscribe;
  }, [user, refetchInvoices]);

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => base44.entities.RepairOrder.filter({ created_by: user.email }, "-created_date", 500),
    enabled: !!user,
  });

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => base44.entities.Mechanic.filter({ created_by: user.email }, "-created_date", 50),
    enabled: !!user,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["timeEntries", "all", user?.email],
    queryFn: () => base44.entities.TimeEntry.filter({ created_by: user.email }, "-clock_in", 500),
    enabled: !!user,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts", user?.email],
    queryFn: () => base44.entities.Part.filter({ created_by: user.email }, "-created_date", 500),
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", user?.email],
    queryFn: () => base44.entities.Expense.filter({ created_by: user.email }, "-expense_date", 500),
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 1000),
    enabled: !!user,
  });

  // Apply data filters
  let paidInvoices = invoices.filter(i => i.status === "paid");
  
  if (filterPaymentMethod) {
    paidInvoices = paidInvoices.filter(i => {
      const method = i.payment_method?.toLowerCase() || "cash";
      return method === filterPaymentMethod.toLowerCase();
    });
  }

  const filteredOrders = filterStatus 
    ? orders.filter(o => o.status === filterStatus)
    : orders;
  
  const filteredMechanic = filterMechanic
    ? mechanics.find(m => m.id === filterMechanic)
    : null;
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalLaborRevenue = paidInvoices.reduce((sum, i) => sum + (i.labor_total || 0), 0);
  const totalPartsRevenue = paidInvoices.reduce((sum, i) => sum + (i.parts_total || 0), 0);
  const avgPerJob = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  const filteredRevenue = useMemo(() => {
    if (revPeriod === "Custom") {
      return paidInvoices
        .filter(i => {
          const d = i.paid_date || i.created_date?.substring(0, 10);
          if (!d) return false;
          if (customDateFrom && d < customDateFrom) return false;
          if (customDateTo && d > customDateTo) return false;
          return true;
        })
        .reduce((sum, i) => sum + (i.total || 0), 0);
    }
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
  }, [paidInvoices, revPeriod, customDateFrom, customDateTo]);

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
    const mechOrders = (filterMechanic ? (m.id === filterMechanic ? orders.filter(o => o.mechanic_id === m.id) : []) : orders.filter(o => o.mechanic_id === m.id));
    const completed = mechOrders.filter(o => o.status === "completed" || o.status === "delivered").length;
    const hours = mechOrders.reduce((sum, o) => sum + (o.labor_hours || 0), 0);
    const revenue = mechOrders.reduce((sum, o) => sum + (o.labor_cost || 0), 0);
    return { name: m.name, completed, hours, revenue, id: m.id };
  }).filter(m => !filterMechanic || m.id === filterMechanic);

  // Daily cash vs card vs e-transfer report (track ALL payments including partial)
  const dailyPayments = {};
  invoices.forEach(inv => {
    // Track ALL invoices with payment (paid OR partial), not just fully paid
    if (inv.status !== "paid" && inv.status !== "partial") return;
    
    const history = inv.payment_history || [];

    // PRIORITY: Use payment_history entries (most accurate for partial payments)
    if (history.length > 0) {
      history.forEach(entry => {
        const day = entry.date;
        if (!day) return;
        if (!dailyPayments[day]) dailyPayments[day] = { date: day, cash: 0, card: 0, etransfer: 0 };
        
        const m = entry.method?.toLowerCase() || "cash";
        const entryAmount = entry.amount || 0;
        if (m === "e-transfer" || m === "etransfer") {
          dailyPayments[day].etransfer += entryAmount;
        } else if (m === "card") {
          dailyPayments[day].card += entryAmount;
        } else {
          dailyPayments[day].cash += entryAmount;
        }
      });
      return; // Use history and skip fallback
    }

    // Fallback: if no payment_history, use paid_date + payment_method (for fully paid invoices)
    if (inv.status === "paid") {
      const day = inv.paid_date || inv.created_date?.substring(0, 10);
      if (!day) return;
      if (!dailyPayments[day]) dailyPayments[day] = { date: day, cash: 0, card: 0, etransfer: 0 };
      
      const amount = inv.total || 0;
      const method = inv.payment_method?.toLowerCase() || "";
      if (method === "e-transfer" || method === "etransfer") {
        dailyPayments[day].etransfer += amount;
      } else if (method === "card" || inv.card_last4) {
        dailyPayments[day].card += amount;
      } else {
        dailyPayments[day].cash += amount;
      }
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

  // Top-selling parts analysis
  const partsUsageMap = {};
  orders.forEach(order => {
    if (order.parts_used && Array.isArray(order.parts_used)) {
      order.parts_used.forEach(part => {
        if (!partsUsageMap[part.name]) {
          partsUsageMap[part.name] = { name: part.name, quantity: 0, revenue: 0, count: 0 };
        }
        partsUsageMap[part.name].quantity += part.quantity || 1;
        partsUsageMap[part.name].revenue += part.total || 0;
        partsUsageMap[part.name].count += 1;
      });
    }
  });
  const topParts = Object.values(partsUsageMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Generate PDF reports
  const generateMonthlyRevenueReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    doc.setFontSize(20);
    doc.setTextColor(14, 165, 233);
    doc.text("Monthly Revenue Report", 20, yPos);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPos + 8);
    yPos += 20;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Revenue by Month", 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.setDrawColor(220);
    const tableData = [["Month", "Labor", "Parts", "Total"]];
    monthlyChart.forEach(m => {
      tableData.push([m.month, `$${m.labor.toFixed(2)}`, `$${m.parts.toFixed(2)}`, `$${m.revenue.toFixed(2)}`]);
    });

    doc.autoTable({
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 20, right: 20 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Summary", 20, yPos);
    yPos += 8;

    const totalRevenue = monthlyChart.reduce((sum, m) => sum + m.revenue, 0);
    const totalLabor = monthlyChart.reduce((sum, m) => sum + m.labor, 0);
    const totalParts = monthlyChart.reduce((sum, m) => sum + m.parts, 0);

    doc.setFontSize(10);
    doc.text(`Total Revenue: $${totalRevenue.toFixed(2)}`, 30, yPos);
    doc.text(`Total Labor: $${totalLabor.toFixed(2)}`, 30, yPos + 6);
    doc.text(`Total Parts: $${totalParts.toFixed(2)}`, 30, yPos + 12);

    doc.save("Monthly-Revenue-Report.pdf");
  };

  const generateTopPartsReport = () => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(20);
    doc.setTextColor(14, 165, 233);
    doc.text("Top-Selling Parts Report", 20, yPos);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPos + 8);
    yPos += 20;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Top 10 Parts by Revenue", 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const tableData = [["Part Name", "Quantity Sold", "Jobs", "Total Revenue"]];
    topParts.forEach(p => {
      tableData.push([p.name, String(p.quantity), String(p.count), `$${p.revenue.toFixed(2)}`]);
    });

    doc.autoTable({
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 20, right: 20 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' } }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Summary", 20, yPos);
    yPos += 8;

    const totalRevenue = topParts.reduce((sum, p) => sum + p.revenue, 0);
    const totalQuantity = topParts.reduce((sum, p) => sum + p.quantity, 0);

    doc.setFontSize(10);
    doc.text(`Total Parts Revenue: $${totalRevenue.toFixed(2)}`, 30, yPos);
    doc.text(`Total Units Sold: ${totalQuantity}`, 30, yPos + 6);

    doc.save("Top-Parts-Report.pdf");
  };

  const generateTechnicianProductivityReport = () => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(20);
    doc.setTextColor(14, 165, 233);
    doc.text("Technician Productivity Report", 20, yPos);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPos + 8);
    yPos += 20;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Productivity by Technician", 20, yPos);
    yPos += 10;

    doc.setFontSize(9);
    const tableData = [["Technician", "Completed Jobs", "Hours Worked", "Revenue Generated"]];
    mechProductivity.forEach(m => {
      tableData.push([m.name, String(m.completed), m.hours.toFixed(1), `$${m.revenue.toFixed(2)}`]);
    });

    doc.autoTable({
      startY: yPos,
      head: [tableData[0]],
      body: tableData.slice(1),
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 20, right: 20 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Summary", 20, yPos);
    yPos += 8;

    const totalJobs = mechProductivity.reduce((sum, m) => sum + m.completed, 0);
    const totalRevenue = mechProductivity.reduce((sum, m) => sum + m.revenue, 0);
    const avgRevenuePerJob = totalJobs > 0 ? totalRevenue / totalJobs : 0;

    doc.setFontSize(10);
    doc.text(`Total Completed Jobs: ${totalJobs}`, 30, yPos);
    doc.text(`Total Revenue Generated: $${totalRevenue.toFixed(2)}`, 30, yPos + 6);
    doc.text(`Average Revenue Per Job: $${avgRevenuePerJob.toFixed(2)}`, 30, yPos + 12);

    doc.save("Technician-Productivity-Report.pdf");
  };

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

  // Expense handling
  const handleSaveExpense = async () => {
    if (!expenseForm.category || !expenseForm.amount) return;
    setSavingExpense(true);
    await base44.entities.Expense.create({
      category: expenseForm.category,
      description: expenseForm.description,
      amount: Number(expenseForm.amount),
      expense_date: expenseForm.expense_date,
      notes: expenseForm.notes,
    });
    setSavingExpense(false);
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    setExpenseDialogOpen(false);
    setExpenseForm({ category: "supplies", description: "", amount: "", expense_date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm("Delete this expense?")) {
      await base44.entities.Expense.delete(id);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
  };

  // Monthly profit/loss
  const monthlyProfitLoss = {};
  paidInvoices.forEach(inv => {
    const date = inv.paid_date || inv.created_date?.substring(0, 10);
    if (!date) return;
    const month = date.substring(0, 7);
    if (!monthlyProfitLoss[month]) monthlyProfitLoss[month] = { month, revenue: 0, expenses: 0 };
    monthlyProfitLoss[month].revenue += inv.total || 0;
  });
  expenses.forEach(exp => {
    const month = exp.expense_date.substring(0, 7);
    if (!monthlyProfitLoss[month]) monthlyProfitLoss[month] = { month, revenue: 0, expenses: 0 };
    monthlyProfitLoss[month].expenses += exp.amount || 0;
  });
  const profitLossChart = Object.values(monthlyProfitLoss)
    .map(item => ({ ...item, profit: item.revenue - item.expenses }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);

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

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-800/50 border border-gray-700">
          <TabsTrigger value="insights" className="text-sm data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Insights</TabsTrigger>
          <TabsTrigger value="overview" className="text-sm data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Overview</TabsTrigger>
          <TabsTrigger value="profitloss" className="text-sm data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Profit & Loss</TabsTrigger>
          <TabsTrigger value="reports" className="text-sm data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            PDF Reports
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "insights" && (() => {
        // --- 1. Monthly Revenue (last 6 months, paid invoices only) ---
        const now = new Date();
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("default", { month: "short", year: "2-digit" }) };
        });
        const revenueByMonth = {};
        last6Months.forEach(m => { revenueByMonth[m.key] = 0; });
        paidInvoices.forEach(inv => {
          const d = inv.paid_date || inv.created_date?.substring(0, 10);
          if (!d) return;
          const key = d.substring(0, 7);
          if (revenueByMonth[key] !== undefined) revenueByMonth[key] += inv.total || 0;
        });
        const revenueChartData = last6Months.map(m => ({ month: m.label, revenue: revenueByMonth[m.key] }));

        // --- 2. Top Services (from repair order descriptions/service types) ---
        const serviceMap = {};
        orders.forEach(o => {
          // Try to extract a clean service keyword from description
          const raw = (o.description || "Other").trim();
          const key = raw.length > 40 ? raw.substring(0, 40) + "…" : raw;
          serviceMap[key] = (serviceMap[key] || 0) + 1;
        });
        const topServices = Object.entries(serviceMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, value]) => ({ name, value }));

        // --- 3. Customer Stats ---
        const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const newCustomersThisMonth = customers.filter(c => c.created_date?.substring(0, 7) === thisMonthKey).length;
        const roCountByCustomer = {};
        orders.forEach(o => { if (o.customer_id) roCountByCustomer[o.customer_id] = (roCountByCustomer[o.customer_id] || 0) + 1; });
        const returningCustomers = Object.values(roCountByCustomer).filter(v => v > 1).length;

        // --- 4. Mechanic Performance ---
        const mechPerf = mechanics.map(m => {
          const mechOrders = orders.filter(o => o.mechanic_id === m.id);
          const totalJobs = mechOrders.length;
          const totalHours = mechOrders.reduce((s, o) => s + (o.labor_hours || 0), 0);
          const totalRevenue = mechOrders.reduce((s, o) => s + (o.labor_cost || 0), 0);
          return { name: m.name, totalJobs, totalHours, totalRevenue };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        const CHART_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

        return (
          <div className="space-y-6">
            {/* 1. Revenue Bar Chart */}
            <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
              <h3 className="text-white font-semibold mb-1">Monthly Revenue</h3>
              <p className="text-gray-400 text-xs mb-4">Last 6 months — paid invoices only</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                      formatter={v => [`$${v.toFixed(2)}`, "Revenue"]}
                    />
                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2 + 3: Top Services + Customer Stats side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2. Top Services Donut */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
                <h3 className="text-white font-semibold mb-1">Top Services</h3>
                <p className="text-gray-400 text-xs mb-4">Most common repair types from all orders</p>
                {topServices.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">No repair orders yet</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="h-48 w-48 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={topServices} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                            {topServices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                            formatter={(v, n) => [v + " orders", n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      {topServices.map((s, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-gray-300 text-xs truncate">{s.name}</span>
                          </div>
                          <span className="text-gray-400 text-xs font-medium flex-shrink-0">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Customer Stats */}
              <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
                <h3 className="text-white font-semibold mb-1">Customer Stats</h3>
                <p className="text-gray-400 text-xs mb-4">Overview of your customer base</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between rounded-lg bg-sky-500/10 border border-sky-500/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-sky-400" />
                      <span className="text-gray-300 text-sm">Total Customers</span>
                    </div>
                    <span className="text-2xl font-bold text-sky-400">{customers.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span className="text-gray-300 text-sm">New This Month</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-400">{newCustomersThisMonth}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-purple-500/10 border border-purple-500/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Wrench className="w-5 h-5 text-purple-400" />
                      <span className="text-gray-300 text-sm">Returning Customers <span className="text-gray-500 text-xs">(2+ ROs)</span></span>
                    </div>
                    <span className="text-2xl font-bold text-purple-400">{returningCustomers}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Mechanic Performance Table */}
            <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
              <h3 className="text-white font-semibold mb-1">Mechanic Performance</h3>
              <p className="text-gray-400 text-xs mb-4">All-time jobs, hours, and labor revenue per mechanic</p>
              {mechPerf.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No mechanics added yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800/50">
                        <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Mechanic</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Total Jobs</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Total Hours</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Labor Revenue</th>
                        <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Avg / Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mechPerf.map((m, i) => (
                        <tr key={m.name} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-white font-medium">{m.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300">{m.totalJobs}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{m.totalHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">${m.totalRevenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-sky-400">${m.totalJobs > 0 ? (m.totalRevenue / m.totalJobs).toFixed(2) : "0.00"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-700">
                      <tr>
                        <td className="px-4 py-3 text-gray-400 font-bold text-xs uppercase">Total</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-bold">{mechPerf.reduce((s, m) => s + m.totalJobs, 0)}</td>
                        <td className="px-4 py-3 text-right text-gray-300 font-bold">{mechPerf.reduce((s, m) => s + m.totalHours, 0).toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">${mechPerf.reduce((s, m) => s + m.totalRevenue, 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === "profitloss" && (
        <div className="space-y-6">
          {/* Expenses Card */}
          <div className="rounded-xl border border-red-700/30 bg-gradient-to-br from-red-900/30 to-red-950/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold mb-1">Monthly Expenses</h3>
                <p className="text-gray-400 text-xs">Record and track business costs</p>
              </div>
              <Button onClick={() => setExpenseDialogOpen(true)} className="gap-1.5 text-xs h-8">
                <Plus className="w-3.5 h-3.5" /> Add Expense
              </Button>
            </div>
            
            {expenses.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/50">
                      <th className="text-left text-xs text-gray-400 font-medium px-3 py-2">Date</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-3 py-2">Category</th>
                      <th className="text-left text-xs text-gray-400 font-medium px-3 py-2">Description</th>
                      <th className="text-right text-xs text-gray-400 font-medium px-3 py-2">Amount</th>
                      <th className="text-center text-xs text-gray-400 font-medium px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...expenses].reverse().map(exp => (
                      <tr key={exp.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                        <td className="px-3 py-2 text-gray-300">{exp.expense_date}</td>
                        <td className="px-3 py-2 text-gray-300 capitalize">{exp.category}</td>
                        <td className="px-3 py-2 text-gray-400">{exp.description || "—"}</td>
                        <td className="px-3 py-2 text-right text-red-400 font-semibold">${exp.amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-rose-400 hover:text-rose-300"
                            onClick={() => handleDeleteExpense(exp.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Monthly P&L Chart */}
          {profitLossChart.length > 0 && (
            <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
              <h3 className="text-white font-semibold mb-4">Monthly Profit & Loss</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitLossChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0" }}
                      formatter={(v) => [`$${v.toFixed(2)}`]}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="Profit" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* P&L Summary Table */}
          {profitLossChart.length > 0 && (
            <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
              <h3 className="text-white font-semibold mb-4">Profit & Loss Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/50">
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Month</th>
                      <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Revenue</th>
                      <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Expenses</th>
                      <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Profit</th>
                      <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitLossChart.map(row => {
                      const margin = row.revenue > 0 ? (row.profit / row.revenue * 100) : 0;
                      return (
                        <tr key={row.month} className="border-b border-gray-800/30">
                          <td className="px-4 py-3 text-gray-200 font-medium">{row.month}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">${row.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-red-400">${row.expenses.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: row.profit >= 0 ? "#10b981" : "#ef4444" }}>
                            ${row.profit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: margin >= 0 ? "#10b981" : "#ef4444" }}>
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-700 bg-gray-900">
                    {(() => {
                      const totals = profitLossChart.reduce((acc, row) => ({
                        revenue: acc.revenue + row.revenue,
                        expenses: acc.expenses + row.expenses,
                        profit: acc.profit + row.profit
                      }), { revenue: 0, expenses: 0, profit: 0 });
                      const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue * 100) : 0;
                      return (
                        <tr>
                          <td className="px-4 py-3 text-sm font-bold text-gray-300">TOTAL</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-bold">${totals.revenue.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-bold">${totals.expenses.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold" style={{ color: totals.profit >= 0 ? "#10b981" : "#ef4444" }}>
                            ${totals.profit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold" style={{ color: totalMargin >= 0 ? "#10b981" : "#ef4444" }}>
                            {totalMargin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Generate Automated Reports</h2>
            <p className="text-gray-400 text-sm">Download detailed PDFs for monthly revenue, top parts, and technician productivity</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={generateMonthlyRevenueReport}
              className="bg-sky-500 hover:bg-sky-600 text-white gap-2 h-auto py-4 flex flex-col items-center justify-center"
            >
              <FileText className="w-5 h-5" />
              <span>Monthly Revenue</span>
              <span className="text-xs font-normal opacity-80">12-month breakdown</span>
            </Button>

            <Button
              onClick={generateTopPartsReport}
              className="bg-purple-500 hover:bg-purple-600 text-white gap-2 h-auto py-4 flex flex-col items-center justify-center"
            >
              <FileText className="w-5 h-5" />
              <span>Top-Selling Parts</span>
              <span className="text-xs font-normal opacity-80">Top 10 by revenue</span>
            </Button>

            <Button
              onClick={generateTechnicianProductivityReport}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2 h-auto py-4 flex flex-col items-center justify-center"
            >
              <FileText className="w-5 h-5" />
              <span>Technician Report</span>
              <span className="text-xs font-normal opacity-80">Productivity metrics</span>
            </Button>
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <>
        {/* Data Filters */}
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 font-medium mb-2">Filter by Mechanic</label>
              <Select value={filterMechanic} onValueChange={setFilterMechanic}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="All Mechanics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Mechanics</SelectItem>
                  {mechanics.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 font-medium mb-2">Filter by Order Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Statuses</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_for_parts">Waiting for Parts</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 font-medium mb-2">Filter by Payment Method</label>
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="e-transfer">E-Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filterMechanic || filterStatus || filterPaymentMethod) && (
              <Button 
                onClick={() => { setFilterMechanic(""); setFilterStatus(""); setFilterPaymentMethod(""); }}
                variant="outline"
                size="sm"
                className="gap-2 h-9 bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clickable Total Revenue card with period toggle */}
        <div className={`rounded-xl border border-green-700/30 bg-gradient-to-br from-green-900/30 to-green-950/10 p-4 select-none ${revPeriod !== "Custom" ? "cursor-pointer" : ""}`}
          onClick={() => { if (revPeriod !== "Custom") setRevPeriod(p => { const i = REVENUE_PERIODS.indexOf(p); return REVENUE_PERIODS[(i + 1) % REVENUE_PERIODS.length]; }); }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 font-medium">Revenue ({revPeriod === "Custom" && (customDateFrom || customDateTo) ? `${customDateFrom || "…"} → ${customDateTo || "…"}` : revPeriod})</p>
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-400">${filteredRevenue.toFixed(2)}</p>
          <div className="flex gap-1 mt-2 flex-wrap">
            {REVENUE_PERIODS.map(p => (
              <span key={p} onClick={e => { e.stopPropagation(); setRevPeriod(p); }}
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                  revPeriod === p ? "bg-green-500/30 text-green-300" : "text-gray-600 hover:text-gray-400"
                }`}>{p}</span>
            ))}
          </div>
          {revPeriod === "Custom" && (
            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
              <input
                type="date"
                value={customDateFrom}
                onChange={e => setCustomDateFrom(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-green-500"
                placeholder="From"
              />
              <input
                type="date"
                value={customDateTo}
                onChange={e => setCustomDateTo(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-green-500"
                placeholder="To"
              />
            </div>
          )}
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
          <button onClick={() => setPaymentMethodModal("cash")}
            className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all text-left w-full">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Cash</p>
              <p className="text-lg font-bold text-emerald-400">${todayData.cash.toFixed(2)}</p>
            </div>
          </button>
          <button onClick={() => setPaymentMethodModal("card")}
            className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 flex items-center gap-3 hover:bg-sky-500/20 hover:border-sky-500/40 transition-all text-left w-full">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Card</p>
              <p className="text-lg font-bold text-sky-400">${todayData.card.toFixed(2)}</p>
            </div>
          </button>
          <button onClick={() => setPaymentMethodModal("etransfer")}
            className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4 flex items-center gap-3 hover:bg-orange-500/20 hover:border-orange-500/40 transition-all text-left w-full">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — E-Transfer</p>
              <p className="text-lg font-bold text-orange-400">${todayData.etransfer.toFixed(2)}</p>
            </div>
          </button>
          <button onClick={() => setPaymentMethodModal("all")}
            className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4 flex items-center gap-3 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-left w-full">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Today — Total</p>
              <p className="text-lg font-bold text-purple-400">${(todayData.cash + todayData.card + todayData.etransfer).toFixed(2)}</p>
            </div>
          </button>
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
        </>
      )}

      {/* Payment Method Invoices Modal */}
      <Dialog open={!!paymentMethodModal} onOpenChange={() => setPaymentMethodModal(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {paymentMethodModal === "all" ? "All" : paymentMethodModal === "etransfer" ? "E-Transfer" : paymentMethodModal} — Today's Invoices
            </DialogTitle>
          </DialogHeader>
          {(() => {
                 // Get payment history entries for today filtered by method
                 const todayPayments = [];
                 invoices.forEach(inv => {
                   const history = inv.payment_history || [];
                   history.forEach(entry => {
                     const entryDay = entry.date;
                     if (entryDay !== today) return;

                     const m = entry.method?.toLowerCase() || "cash";
                     let methodMatch = false;
                     if (paymentMethodModal === "all") methodMatch = true;
                     else if (paymentMethodModal === "etransfer") methodMatch = (m === "e-transfer" || m === "etransfer");
                     else if (paymentMethodModal === "card") methodMatch = (m === "card");
                     else if (paymentMethodModal === "cash") methodMatch = (m === "cash" || !m);

                     if (methodMatch) {
                       todayPayments.push({
                         invoiceNumber: inv.invoice_number || inv.id.slice(0, 8),
                         customer: inv.customer_name,
                         vehicle: inv.vehicle_info,
                         method: entry.method,
                         amount: entry.amount,
                         note: entry.note,
                         invoiceId: inv.id
                       });
                     }
                   });
                 });

                 // Fallback to old logic for invoices without payment_history
                 const todayInvoices = invoices.filter(inv => {
                   if (inv.status !== "paid" && inv.status !== "partial") return false;
                   if ((inv.payment_history || []).length > 0) return false; // Skip if already in todayPayments
                   const day = inv.paid_date || inv.created_date?.substring(0, 10);
                   if (day !== today) return false;
                   if (paymentMethodModal === "all") return true;
                   const method = inv.payment_method?.toLowerCase() || "cash";
                   if (paymentMethodModal === "etransfer") return method === "e-transfer" || method === "etransfer";
                   if (paymentMethodModal === "card") return method === "card" || !!inv.card_last4;
                   if (paymentMethodModal === "cash") return method === "cash" || (!method && !inv.card_last4);
                   return false;
                 });

                 if (todayPayments.length === 0 && todayInvoices.length === 0) {
                   return <p className="text-gray-400 text-sm py-4 text-center">No payments found for today with this method.</p>;
                 }

                 return (
                   <>
                     {todayPayments.length > 0 && (
                       <table className="w-full text-sm mt-2">
                         <thead>
                           <tr className="border-b border-gray-700">
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Invoice #</th>
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Customer</th>
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Vehicle</th>
                             <th className="text-right text-xs text-gray-400 px-3 py-2">Amount</th>
                           </tr>
                         </thead>
                         <tbody>
                           {todayPayments.map((p, i) => (
                             <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                               onClick={() => { setPaymentMethodModal(null); window.location.href = `/InvoiceDetail/${p.invoiceId}`; }}>
                               <td className="px-3 py-2 text-sky-400 font-mono font-semibold">{p.invoiceNumber}</td>
                               <td className="px-3 py-2 text-gray-200">{p.customer}</td>
                               <td className="px-3 py-2 text-gray-400 text-xs">{p.vehicle || "—"}</td>
                               <td className="px-3 py-2 text-right text-emerald-400 font-semibold">${(p.amount || 0).toFixed(2)}</td>
                             </tr>
                           ))}
                           <tr className="border-t border-gray-700 bg-gray-900/50">
                             <td colSpan={3} className="px-3 py-2 text-gray-400 font-semibold text-sm">Today Total</td>
                             <td className="px-3 py-2 text-right text-emerald-400 font-bold">
                               ${todayPayments.reduce((s, p) => s + (p.amount || 0), 0).toFixed(2)}
                             </td>
                           </tr>
                         </tbody>
                       </table>
                     )}
                     {todayInvoices.length > 0 && (
                       <table className="w-full text-sm mt-4">
                         <thead>
                           <tr className="border-b border-gray-700">
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Invoice #</th>
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Customer</th>
                             <th className="text-left text-xs text-gray-400 px-3 py-2">Vehicle</th>
                             <th className="text-right text-xs text-gray-400 px-3 py-2">Total</th>
                           </tr>
                         </thead>
                         <tbody>
                           {todayInvoices.map(inv => (
                             <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                               onClick={() => { setPaymentMethodModal(null); window.location.href = `/InvoiceDetail/${inv.id}`; }}>
                               <td className="px-3 py-2 text-sky-400 font-mono">{inv.invoice_number || inv.id.slice(0,8)}</td>
                               <td className="px-3 py-2 text-gray-200">{inv.customer_name}</td>
                               <td className="px-3 py-2 text-gray-400">{inv.vehicle_info || "—"}</td>
                               <td className="px-3 py-2 text-right text-emerald-400 font-semibold">${(inv.total || 0).toFixed(2)}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     )}
                   </>
                 );
               })()}
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Category *</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="supplies">Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Description</Label>
              <Input
                placeholder="e.g., Monthly shop rent"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Amount ($) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Date *</Label>
              <Input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-400">Notes</Label>
              <Input
                placeholder="Additional details"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setExpenseDialogOpen(false)}
                className="flex-1 border-gray-700 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveExpense}
                disabled={savingExpense || !expenseForm.category || !expenseForm.amount}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {savingExpense ? "Saving..." : "Add Expense"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}