import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Wrench, CheckCircle2, Clock, Calendar, Car, ChevronRight, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/dashboard/StatCard";
import RecentOrders from "../components/dashboard/RecentOrders";
import RecentEstimates from "../components/dashboard/RecentEstimates";
import RecentInvoices from "../components/dashboard/RecentInvoices";
import TodayAppointments from "../components/dashboard/TodayAppointments";
import WebBookings from "../components/dashboard/WebBookings";
import KpiCards from "../components/dashboard/KpiCards";
import FinancialSummary from "../components/dashboard/FinancialSummary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "../components/shared/StatusBadge";

export default function Dashboard() {
  const [modal, setModal] = useState(null);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", user?.email],
    queryFn: () => user ? base44.entities.Appointment.filter({created_by: user.email}, "-date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["parts", user?.email],
    queryFn: () => user ? base44.entities.Part.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => user ? base44.entities.Invoice.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const lowStockParts = parts.filter(p => (p.quantity ?? 0) < 5);
  const today = new Date().toISOString().split("T")[0];
  const STATUS_PRIORITY = { in_progress: 0, waiting: 1, waiting_for_parts: 2, completed: 3, delivered: 4 };
  const sortByStatus = (arr) => [...arr].sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));

  const waiting    = orders.filter(o => o.status === "waiting");
  const inProgress = orders.filter(o => o.status === "in_progress");
  const completed  = orders.filter(o => o.status === "completed" || o.status === "delivered");
  const todayAppts = appointments.filter(a => a.date === today);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Welcome back. Here's your shop overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vehicles Waiting" value={waiting.length} icon={Clock} color="amber"
          onClick={() => setModal({ title: "Vehicles Waiting", items: waiting, type: "order" })} />
        <StatCard title="In Progress" value={inProgress.length} icon={Wrench} color="sky"
          onClick={() => setModal({ title: "In Progress", items: inProgress, type: "order" })} />
        <StatCard title="Completed" value={completed.length} icon={CheckCircle2} color="green"
          onClick={() => setModal({ title: "Completed", items: completed, type: "order" })} />
        <StatCard title="Today's Appts" value={todayAppts.length} icon={Calendar} color="purple"
          onClick={() => setModal({ title: "Today's Appointments", items: todayAppts, type: "appt" })} />
      </div>

      {/* Low Stock Alert */}
      {lowStockParts.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-rose-300 font-semibold text-sm">
              Low Stock — {lowStockParts.length} part{lowStockParts.length > 1 ? "s" : ""} need reordering
            </h3>
          </div>
          <div className="space-y-2">
            {lowStockParts.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-900/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">{p.name}</span>
                  {p.part_number && <span className="text-gray-500 text-xs">#{p.part_number}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.quantity === 0 ? "bg-rose-500/30 text-rose-300" : "bg-amber-500/30 text-amber-300"}`}>
                    {p.quantity} left
                  </span>
                  <Button size="sm" variant="outline" onClick={() => navigate("/Parts")}
                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/20 h-7 text-xs px-2">
                    Reorder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Summary Widget */}
      <FinancialSummary invoices={invoices} orders={orders} />

      {/* KPI Summary */}
      <KpiCards orders={orders} appointments={appointments} invoices={invoices} />


      {/* Web Bookings — connected site indicator */}
      <WebBookings appointments={appointments} />

      {/* 4-widget scrollable grid — single source, no duplication */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <RecentOrders    orders={orders}         customers={customers} />
        <RecentEstimates estimates={estimates}   customers={customers} />
        <RecentInvoices  invoices={invoices}     customers={customers} />
        <TodayAppointments appointments={appointments} customers={customers}
          onApptClick={(appt) => { setModal({ title: "Today's Appointments", items: todayAppts, type: "appt" }); setSelectedAppt(appt); }} />
      </div>

      {/* Modal — stat card drilldown */}
      <Dialog open={!!modal} onOpenChange={() => { setModal(null); setSelectedAppt(null); }}>
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
            {modal?.type === "order" && sortByStatus(modal?.items || []).map(o => (
              <button key={o.id} onClick={() => { setModal(null); navigate(`/RepairOrderDetail/${o.id}`); }}
                className="w-full bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-gray-700 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-green-400 font-medium text-sm">{o.vehicle_info || "Unknown Vehicle"}</p>
                    <p className="text-gray-400 text-xs"><span className="text-blue-400">{o.customer_name}</span> · #{o.order_number || o.id?.slice(0,6)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} />
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </button>
            ))}
            {modal?.type === "appt" && !selectedAppt && modal?.items?.map(a => (
              <button key={a.id} onClick={() => setSelectedAppt(a)}
                className="w-full bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-gray-700 transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-blue-400 font-medium text-sm">{a.customer_name}</p>
                    <p className="text-gray-400 text-xs">{a.time_slot} · {a.service_type}</p>
                    <p className="text-green-400 text-xs">{a.vehicle_info}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </button>
            ))}
            {modal?.type === "appt" && selectedAppt && (
              <div className="space-y-4">
                <button onClick={() => setSelectedAppt(null)} className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-sm">
                  ← Back to list
                </button>
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-blue-400 font-semibold text-base">{selectedAppt.customer_name}</p>
                    <StatusBadge status={selectedAppt.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-1">Date</p>
                      <p className="text-white">{new Date(selectedAppt.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-1">Time</p>
                      <p className="text-white">{selectedAppt.time_slot || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-1">Service</p>
                      <p className="text-white">{selectedAppt.service_type || "—"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
                      <p className="text-green-400">{selectedAppt.vehicle_info || "—"}</p>
                    </div>
                  </div>
                  {selectedAppt.notes && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase mb-1">Notes</p>
                      <p className="text-gray-300 text-sm">{selectedAppt.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}