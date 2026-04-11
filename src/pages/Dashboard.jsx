import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Wrench, CheckCircle2, Clock, Calendar, X, Car } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentOrders from "../components/dashboard/RecentOrders";
import TodayAppointments from "../components/dashboard/TodayAppointments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "../components/shared/StatusBadge";

export default function Dashboard() {
  const [modal, setModal] = useState(null); // { title, items }

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 100),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("-date", 50),
  });

  const today = new Date().toISOString().split("T")[0];

  const waiting = orders.filter(o => o.status === "waiting");
  const inProgress = orders.filter(o => o.status === "in_progress");
  const completed = orders.filter(o => o.status === "completed" || o.status === "delivered");
  const todayAppts = appointments.filter(a => a.date === today);

  const openModal = (title, items, type) => setModal({ title, items, type });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back. Here's your shop overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vehicles Waiting" value={waiting.length} icon={Clock} color="amber"
          onClick={() => openModal("Vehicles Waiting", waiting, "order")} />
        <StatCard title="In Progress" value={inProgress.length} icon={Wrench} color="sky"
          onClick={() => openModal("In Progress", inProgress, "order")} />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle2} color="green"
          onClick={() => openModal("Completed", completed, "order")} />
        <StatCard title="Today's Appts" value={todayAppts.length} icon={Calendar} color="purple"
          onClick={() => openModal("Today's Appointments", todayAppts, "appt")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayAppointments appointments={appointments} />
        <RecentOrders orders={orders} />
      </div>

      {/* Modal */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-sky-400" />
              {modal?.title}
              <span className="text-gray-500 text-sm font-normal ml-1">({modal?.items?.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {modal?.items?.length === 0 && (
              <p className="text-gray-500 text-center py-6">No items found.</p>
            )}
            {modal?.type === "order" && modal?.items?.map(o => (
              <div key={o.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{o.vehicle_info || "Unknown Vehicle"}</p>
                    <p className="text-gray-400 text-xs">{o.customer_name} · #{o.order_number || o.id?.slice(0,6)}</p>
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>
            ))}
            {modal?.type === "appt" && modal?.items?.map(a => (
              <div key={a.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{a.vehicle_info || "Unknown Vehicle"}</p>
                    <p className="text-gray-400 text-xs">{a.customer_name} · {a.time_slot} · {a.service_type}</p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}