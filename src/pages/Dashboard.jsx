import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Calendar
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentOrders from "../components/dashboard/RecentOrders";
import TodayAppointments from "../components/dashboard/TodayAppointments";

export default function Dashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 100),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("-date", 50),
  });

  const waiting = orders.filter(o => o.status === "waiting").length;
  const inProgress = orders.filter(o => o.status === "in_progress").length;
  const completed = orders.filter(o => o.status === "completed" || o.status === "delivered").length;

  const today = new Date().toISOString().split("T")[0];
  const todayAppts = appointments.filter(a => a.date === today).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back. Here's your shop overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vehicles Waiting" value={waiting} icon={Clock} color="amber" />
        <StatCard title="In Progress" value={inProgress} icon={Wrench} color="sky" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} color="green" />
        <StatCard title="Today's Appts" value={todayAppts} icon={Calendar} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayAppointments appointments={appointments} />
        <RecentOrders orders={orders} />
      </div>
    </div>
  );
}