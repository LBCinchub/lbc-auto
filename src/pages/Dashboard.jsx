import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Wrench,
  CheckCircle2,
  DollarSign,
  Clock,
  Users,
  Package,
  Calendar
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RevenueChart from "../components/dashboard/RevenueChart";
import RecentOrders from "../components/dashboard/RecentOrders";
import TodayAppointments from "../components/dashboard/TodayAppointments";

export default function Dashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 100),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 100),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("-date", 50),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("-created_date", 100),
  });

  const waiting = orders.filter(o => o.status === "waiting").length;
  const inProgress = orders.filter(o => o.status === "in_progress").length;
  const completed = orders.filter(o => o.status === "completed" || o.status === "delivered").length;

  const today = new Date().toISOString().split("T")[0];
  const todayRevenue = invoices
    .filter(i => i.status === "paid" && (i.paid_date === today || i.created_date?.startsWith(today)))
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split("T")[0];
  const weeklyRevenue = invoices
    .filter(i => i.status === "paid" && (i.paid_date >= weekStr || i.created_date >= weekStr))
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStr = monthStart.toISOString().split("T")[0];
  const monthlyRevenue = invoices
    .filter(i => i.status === "paid" && (i.paid_date >= monthStr || i.created_date >= monthStr))
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const todayAppts = appointments.filter(a => a.date === today).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back. Here's your shop overview.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vehicles Waiting" value={waiting} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgress} icon={Wrench} color="sky" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} color="green" />
        <StatCard title="Today's Appts" value={todayAppts} icon={Calendar} color="purple" />
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Today's Revenue" value={`$${todayRevenue.toFixed(2)}`} icon={DollarSign} color="green" />
        <StatCard title="Weekly Revenue" value={`$${weeklyRevenue.toFixed(2)}`} icon={DollarSign} color="sky" />
        <StatCard title="Monthly Revenue" value={`$${monthlyRevenue.toFixed(2)}`} icon={DollarSign} color="purple" />
      </div>

      {/* Charts and lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart invoices={invoices} />
        <TodayAppointments appointments={appointments} />
      </div>

      <RecentOrders orders={orders} />
    </div>
  );
}