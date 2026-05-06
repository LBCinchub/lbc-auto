import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Pencil, Trash2, User, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import { formatPhone } from "@/utils/formatPhone";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import AppointmentFormDialog from "../components/appointments/AppointmentFormDialog";

export default function Appointments() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

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
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("-date", 200),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("-created_date", 30000),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("-created_date", 200),
  });
  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list("-created_date", 50),
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
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, appts]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                {date === today && <span className="ml-2 text-sky-400">· Today</span>}
              </h3>
              <div className="space-y-2">
                {appts.map(a => (
                   <button key={a.id}
                     onClick={() => { setEditing(a); setDialogOpen(true); }}
                     className="w-full rounded-xl border border-gray-800/50 bg-gray-900/50 p-4 hover:border-sky-500/30 hover:bg-gray-800/50 transition-all flex items-center justify-between gap-4 text-left">
                     <div className="flex items-center gap-4 min-w-0">
                       <div className="w-16 text-center flex-shrink-0">
                         <p className="text-sky-400 font-semibold text-sm">{a.time_slot}</p>
                       </div>
                       <div className="min-w-0">
                         <div className="flex items-center gap-2 flex-wrap">
                           <span className="text-blue-400 font-medium text-sm">{a.customer_name}</span>
                           <StatusBadge status={a.status} />
                         </div>
                         {(() => { const c = customers.find(c => c.id === a.customer_id); return c?.phone ? <p className="text-xs text-sky-400">{formatPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}</p> : null; })()}
                         <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                           <span className="flex items-center gap-1 text-green-400"><Car className="w-3 h-3" />{a.vehicle_info}</span>
                           <span>{a.service_type}</span>
                           {a.mechanic_name && (
                             <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.mechanic_name}</span>
                           )}
                         </div>
                       </div>
                     </div>
                     <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                         onClick={(e) => { e.stopPropagation(); setEditing(a); setDialogOpen(true); }}>
                         <Pencil className="w-3.5 h-3.5" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                         onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}>
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                     </div>
                   </button>
                 ))}
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );
}