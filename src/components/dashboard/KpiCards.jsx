import React from "react";
import { Calendar, Wrench, AlertCircle, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

function KpiCard({ title, value, icon: Icon, color, sub, onClick }) {
  const colors = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };
  const iconColors = {
    blue: "text-blue-400", amber: "text-amber-400", red: "text-red-400", green: "text-emerald-400",
  };
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-xl border p-5 transition-all hover:scale-[1.02] ${colors[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400 font-medium uppercase tracking-wide">{title}</span>
        <Icon className={`w-5 h-5 ${iconColors[color]}`} />
      </div>
      <p className={`text-3xl font-bold ${iconColors[color]}`}>{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </button>
  );
}

export default function KpiCards({ orders, appointments, invoices }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayAppts = appointments.filter(a => a.date === today).length;
  const activeROs = orders.filter(o => o.status === "in_progress" || o.status === "waiting").length;
  const overdueInvoices = invoices.filter(i =>
    i.status === "unpaid" && new Date(i.created_date) < thirtyDaysAgo
  ).length;
  const revenueThisMonth = invoices
    .filter(i => i.status === "paid" && new Date(i.created_date) >= startOfMonth)
    .reduce((sum, i) => sum + (i.total || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="Today's Appointments" value={todayAppts} icon={Calendar} color="blue"
        sub="scheduled today" onClick={() => navigate("/Appointments")} />
      <KpiCard title="Active Repair Orders" value={activeROs} icon={Wrench} color="amber"
        sub="in progress or waiting" onClick={() => navigate("/RepairOrders")} />
      <KpiCard title="Overdue Invoices" value={overdueInvoices} icon={AlertCircle} color="red"
        sub="unpaid 30+ days" onClick={() => navigate("/Invoices")} />
      <KpiCard title="Revenue This Month" value={`$${revenueThisMonth.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        icon={DollarSign} color="green" sub="from paid invoices" onClick={() => navigate("/Invoices")} />
    </div>
  );
}