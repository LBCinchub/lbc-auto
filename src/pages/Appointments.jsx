import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Pencil, Trash2, User, Car, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import { formatPhone } from "@/utils/formatPhone";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import AppointmentFormDialog from "../components/appointments/AppointmentFormDialog";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";

export default function Appointments() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [roPrompt, setRoPrompt] = useState(null); // appointment to create RO from
  const [roDialogOpen, setRoDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Auto-open dialog if coming from customer profile
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get("customerId");
    if (customerId) {
      setEditing({ _prefillCustomerId: customerId, _prefillCustomerName: params.get("customerName") || "" });
      setDialogOpen(true);
    }
  }, []);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", user?.email],
    queryFn: () => user ? base44.entities.Appointment.filter({ created_by: user.email }, "-date", 200) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({ created_by: user.email }, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => user ? base44.entities.Mechanic.filter({ created_by: user.email }, "-created_date", 50) : Promise.resolve([]),
    enabled: !!user,
  });

  const today = new Date().toISOString().split("T")[0];
  const filtered = appointments
    .filter(a => {
      if (view === "upcoming") return a.date >= today && a.status !== "cancelled";
      if (view === "today") return a.date === today;
      if (view === "past") return a.date < today;
      return true;
    })
    .filter(a => fuzzyMatch(search, [a.customer_name, a.service_type, a.vehicle_info, a.mechanic_name, a.notes]))
    .sort((a, b) => {
      if (a.date === b.date) return (a.time_slot || "").localeCompare(b.time_slot || "");
      return a.date.localeCompare(b.date);
    });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this appointment?")) {
      await base44.entities.Appointment.delete(id);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    }
  };

  const handleStatusChange = async (appt, newStatus) => {
    await base44.entities.Appointment.update(appt.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    if (newStatus === "in_progress" || newStatus === "completed") {
      setRoPrompt(appt);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  // Group appointments by date
  const grouped = filtered.reduce((acc, a) => {
    const d = a.date || "No Date";
    if (!acc[d]) acc[d] = [];
    acc[d].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" subtitle={`${appointments.length} total`}
        onAdd={() => { setEditing(null); setDialogOpen(true); }} addLabel="Book Appointment" />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by customer or service..." />
        </div>
        <Tabs value={view} onValueChange={setView}>
          <TabsList className="bg-gray-800/50">
            <TabsTrigger value="upcoming" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Upcoming</TabsTrigger>
            <TabsTrigger value="today" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Today</TabsTrigger>
            <TabsTrigger value="past" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">Past</TabsTrigger>
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calendar} title="No appointments found" description="Book your first appointment."
          onAction={() => { setEditing(null); setDialogOpen(true); }} actionLabel="Book Appointment" />
      ) : (
        <>
        {/* RO Prompt Banner */}
        {roPrompt && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wrench className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-300 font-medium text-sm">Create a Repair Order for this appointment?</p>
                <p className="text-gray-400 text-xs mt-0.5">{roPrompt.customer_name} · {roPrompt.vehicle_info} · {roPrompt.service_type}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" onClick={() => { setRoDialogOpen(true); }}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Create RO
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRoPrompt(null)} className="text-gray-400 hover:text-white">
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([date, appts]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                {date === today && <span className="ml-2 text-sky-400">· Today</span>}
              </h3>
              <div className="space-y-2">
                {appts.map(a => (
                   <div key={a.id} className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-4 hover:border-sky-500/30 hover:bg-gray-800/50 transition-all flex items-center justify-between gap-4">
                     <button className="flex items-center gap-4 min-w-0 flex-1 text-left"
                       onClick={() => { setEditing(a); setDialogOpen(true); }}>
                       <div className="w-16 text-center flex-shrink-0">
                         <p className="text-sky-400 font-semibold text-sm">{a.time_slot}</p>
                       </div>
                       <div className="min-w-0">
                         <div className="flex items-center gap-2 flex-wrap">
                           <span className="text-blue-400 font-medium text-sm capitalize">{a.customer_name}</span>
                           <StatusBadge status={a.status} />
                         </div>
                         {(() => { const c = customers.find(c => c.id === a.customer_id); return c?.phone ? <p className="text-xs text-amber-400">{formatPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}</p> : null; })()}
                         <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                           <span className="flex items-center gap-1 text-green-400 capitalize"><Car className="w-3 h-3" />{a.vehicle_info}</span>
                           <span>{a.service_type}</span>
                           {a.mechanic_name && (
                             <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.mechanic_name}</span>
                           )}
                         </div>
                       </div>
                     </button>
                     <div className="flex gap-1 flex-shrink-0 items-center">
                       <select
                         value={a.status}
                         onChange={e => handleStatusChange(a, e.target.value)}
                         onClick={e => e.stopPropagation()}
                         className="text-xs bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 mr-1"
                       >
                         <option value="scheduled">Scheduled</option>
                         <option value="confirmed">Confirmed</option>
                         <option value="in_progress">In Progress</option>
                         <option value="completed">Completed</option>
                         <option value="cancelled">Cancelled</option>
                       </select>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                         onClick={() => { setEditing(a); setDialogOpen(true); }}>
                         <Pencil className="w-3.5 h-3.5" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                         onClick={() => handleDelete(a.id)}>
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      <AppointmentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        appointment={editing}
        onSaved={refresh}
        customers={customers}
        vehicles={vehicles}
        mechanics={mechanics}
      />

      {roPrompt && (
        <RepairOrderFormDialog
          open={roDialogOpen}
          onClose={() => { setRoDialogOpen(false); setRoPrompt(null); }}
          order={{
            customer_id: roPrompt.customer_id,
            customer_name: roPrompt.customer_name,
            vehicle_id: roPrompt.vehicle_id,
            vehicle_info: roPrompt.vehicle_info,
            mechanic_id: roPrompt.mechanic_id,
            mechanic_name: roPrompt.mechanic_name,
            description: roPrompt.service_type,
          }}
          onSaved={() => { setRoDialogOpen(false); setRoPrompt(null); queryClient.invalidateQueries({ queryKey: ["orders"] }); }}
          customers={customers}
          vehicles={vehicles}
          mechanics={mechanics}
          parts={[]}
        />
      )}
    </div>
  );
}