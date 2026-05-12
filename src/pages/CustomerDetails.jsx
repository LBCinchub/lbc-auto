import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Car, Calendar,
  ClipboardList, Pencil, Wrench, ChevronRight, DollarSign,
  Clock, Plus, StickyNote, CalendarPlus, Trash2, Lock
} from "lucide-react";
import { formatPhone } from "@/utils/formatPhone";
import CustomerFormDialog from "../components/customers/CustomerFormDialog";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";
import AppointmentFormDialog from "../components/appointments/AppointmentFormDialog";
import EstimateFormDialog from "../components/estimates/EstimateFormDialog";
import VehicleFormDialog from "../components/vehicles/VehicleFormDialog";
import { useQueryClient } from "@tanstack/react-query";

const AVATAR_COLORS = [
  "bg-sky-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-indigo-500"
];
function getAvatarColor(name = "") {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx] || "bg-sky-500";
}

function SkeletonBlock({ className }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />;
}

const statusColors = {
  paid: "bg-emerald-500/20 text-emerald-400",
  unpaid: "bg-rose-500/20 text-rose-400",
  partial: "bg-amber-500/20 text-amber-400",
  overdue: "bg-red-500/20 text-red-400",
  draft: "bg-gray-500/20 text-gray-400",
  sent: "bg-sky-500/20 text-sky-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  declined: "bg-rose-500/20 text-rose-400",
  scheduled: "bg-sky-500/20 text-sky-400",
  confirmed: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-gray-500/20 text-gray-400",
  in_progress: "bg-amber-500/20 text-amber-400",
  waiting: "bg-gray-500/20 text-gray-400",
  waiting_for_parts: "bg-orange-500/20 text-orange-400",
  delivered: "bg-teal-500/20 text-teal-400",
};

const roStatusDot = {
  waiting: "bg-gray-400",
  in_progress: "bg-amber-400",
  waiting_for_parts: "bg-orange-400",
  completed: "bg-emerald-400",
  delivered: "bg-teal-400",
};

function VehicleTimeline({ vehicle, repairOrders }) {
  const vehicleOrders = repairOrders
    .filter(ro => ro.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-gray-800/40 border-b border-gray-800">
        <div className="w-9 h-9 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
          <Car className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white capitalize">{vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div className="flex gap-3 mt-0.5 flex-wrap">
            {vehicle.license_plate && <span className="text-xs text-gray-400 font-mono">Plate: {vehicle.license_plate}</span>}
            {vehicle.vin && <span className="text-xs text-gray-500 font-mono">VIN: {vehicle.vin}</span>}
            {vehicle.mileage && <span className="text-xs text-gray-400">{vehicle.mileage.toLocaleString()} km</span>}
          </div>
        </div>
      </div>

      {vehicleOrders.length === 0 ? (
        <div className="text-gray-600 text-sm py-5 text-center">No repair history for this vehicle.</div>
      ) : (
        <div className="p-4">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-700" />
            <div className="space-y-4">
              {vehicleOrders.map((ro) => (
                <div key={ro.id} className="relative flex gap-4 pl-8">
                  {/* Status dot */}
                  <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 border-gray-900 flex items-center justify-center ${roStatusDot[ro.status] || "bg-gray-500"}`}>
                    <div className="w-2 h-2 rounded-full bg-gray-900" />
                  </div>
                  <div
                    className="flex-1 rounded-lg border border-gray-800 bg-gray-800/30 p-3 cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/60 transition-all"
                    onClick={() => window.location.href = `/RepairOrderDetail/${ro.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{ro.description}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(ro.created_date).toLocaleDateString("en-CA")}
                          {ro.order_number && <span className="ml-2 text-gray-600">#{ro.order_number}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(ro.total_cost > 0) && (
                          <span className="text-sm font-bold text-white">${(ro.total_cost || 0).toFixed(2)}</span>
                        )}
                        <Badge className={`${statusColors[ro.status] || "bg-gray-700 text-gray-300"} text-xs capitalize`}>
                          {ro.status?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const customerId = params.get("id");

  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [repairOrders, setRepairOrders] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [roOpen, setRoOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  // Notes state
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  // Private notes log
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      base44.entities.Customer.filter({ id: customerId }),
      base44.entities.Vehicle.filter({ customer_id: customerId }),
      base44.entities.Invoice.filter({ customer_id: customerId }),
      base44.entities.Estimate.filter({ customer_id: customerId }),
      base44.entities.Appointment.filter({ customer_id: customerId }),
      base44.entities.Mechanic.list("-created_date", 200),
      base44.entities.Vehicle.list("-created_date", 500),
      base44.entities.RepairOrder.filter({ customer_id: customerId }),
    ]).then(([customers, veh, inv, est, appt, mech, allVeh, ros]) => {
      setCustomer(customers[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
      setMechanics(mech);
      setAllVehicles(allVeh);
      setRepairOrders(ros);
      setNotesValue(customers[0]?.notes || "");
    }).finally(() => setLoading(false));
  }, [customerId]);

  const reload = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Customer.filter({ id: customerId }),
      base44.entities.Vehicle.filter({ customer_id: customerId }),
      base44.entities.Invoice.filter({ customer_id: customerId }),
      base44.entities.Estimate.filter({ customer_id: customerId }),
      base44.entities.Appointment.filter({ customer_id: customerId }),
      base44.entities.RepairOrder.filter({ customer_id: customerId }),
    ]).then(([customers, veh, inv, est, appt, ros]) => {
      setCustomer(customers[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
      setRepairOrders(ros);
      setNotesValue(customers[0]?.notes || "");
    }).finally(() => setLoading(false));
  };

  const saveNotes = async () => {
    if (!customer) return;
    setNotesSaving(true);
    await base44.entities.Customer.update(customer.id, { notes: notesValue });
    setNotesSaving(false);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const addNote = async () => {
    if (!newNote.trim() || !customer) return;
    setSavingNote(true);
    const entry = { text: newNote.trim(), created_at: new Date().toISOString() };
    const updatedLog = [entry, ...(customer.notes_log || [])];
    await base44.entities.Customer.update(customer.id, { notes_log: updatedLog });
    setCustomer(prev => ({ ...prev, notes_log: updatedLog }));
    setNewNote("");
    setSavingNote(false);
  };

  const deleteNote = async (idx) => {
    if (!window.confirm("Delete this note?")) return;
    const updatedLog = (customer.notes_log || []).filter((_, i) => i !== idx);
    await base44.entities.Customer.update(customer.id, { notes_log: updatedLog });
    setCustomer(prev => ({ ...prev, notes_log: updatedLog }));
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-CA") : "—";
  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

  // Computed stats
  const totalSpend = invoices
    .filter(inv => inv.status === "paid" || inv.amount_paid > 0)
    .reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || parseFloat(inv.total) || 0), 0);

  const lastVisitDate = repairOrders.length > 0
    ? repairOrders.reduce((latest, ro) => {
        const d = new Date(ro.created_date);
        return d > latest ? d : latest;
      }, new Date(0))
    : null;

  const daysSinceLastVisit = lastVisitDate && lastVisitDate.getTime() > 0
    ? Math.floor((new Date() - lastVisitDate) / (1000 * 60 * 60 * 24))
    : null;

  if (!customerId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No customer selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonBlock className="h-64 w-full" />
        </div>
      ) : !customer ? (
        <div className="text-gray-400 text-center py-20">Customer not found.</div>
      ) : (
        <>
          {/* Customer Info Card */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(customer.full_name)}`}>
                  <span className="text-white font-bold text-xl">
                    {customer.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white capitalize">{customer.full_name}</h1>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300">
                        <Phone className="w-3.5 h-3.5" /> {formatPhone(customer.phone)}
                      </a>
                    )}
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-sky-400">
                        <Mail className="w-3.5 h-3.5" /> {customer.email}
                      </a>
                    )}
                    {customer.address && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-400">
                        <MapPin className="w-3.5 h-3.5" /> {customer.address}
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-semibold">{fmt(totalSpend)}</span>
                      <span className="text-gray-500 text-xs">total spent</span>
                    </div>
                    {daysSinceLastVisit !== null && (
                      <div className="flex items-center gap-1.5 text-sm text-sky-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold">
                          {daysSinceLastVisit === 0 ? "Today" : `${daysSinceLastVisit}d ago`}
                        </span>
                        <span className="text-gray-500 text-xs">last visit</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}
                className="border-gray-700 text-gray-300 hover:text-white gap-1.5 flex-shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              onClick={() => setApptOpen(true)}
              variant="outline"
              className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 gap-2"
            >
              <CalendarPlus className="w-4 h-4" /> New Appointment
            </Button>
            <Button
              onClick={() => setRoOpen(true)}
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 gap-2"
            >
              <Wrench className="w-4 h-4" /> New Repair Order
            </Button>
            <Button
              onClick={() => setEstimateOpen(true)}
              variant="outline"
              className="border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 gap-2"
            >
              <ClipboardList className="w-4 h-4" /> New Estimate
            </Button>
            <Button
              onClick={() => navigate(`/Invoices?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`)}
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 gap-2"
            >
              <FileText className="w-4 h-4" /> Send Invoice
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="vehicles">
            <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="vehicles" className="gap-1.5 data-[state=active]:bg-gray-800">
                <Car className="w-3.5 h-3.5" /> Vehicles ({vehicles.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5 data-[state=active]:bg-gray-800">
                <FileText className="w-3.5 h-3.5" /> Invoices ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="estimates" className="gap-1.5 data-[state=active]:bg-gray-800">
                <ClipboardList className="w-3.5 h-3.5" /> Estimates ({estimates.length})
              </TabsTrigger>
              <TabsTrigger value="appointments" className="gap-1.5 data-[state=active]:bg-gray-800">
                <Calendar className="w-3.5 h-3.5" /> Appointments ({appointments.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 data-[state=active]:bg-gray-800">
                <StickyNote className="w-3.5 h-3.5" /> Notes
              </TabsTrigger>
            </TabsList>

            {/* Vehicles with Timeline */}
            <TabsContent value="vehicles" className="mt-4">
              <div className="flex justify-end mb-3">
                <Button size="sm" variant="outline"
                  className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 gap-1.5"
                  onClick={() => { setEditingVehicle(null); setVehicleDialogOpen(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Add Vehicle
                </Button>
              </div>
              {vehicles.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No vehicles on file.</div>
              ) : (
                <div className="space-y-4">
                  {vehicles.map(v => (
                    <div key={v.id} className="relative group">
                      <div className="absolute top-3 right-3 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white bg-gray-900/80"
                          onClick={() => { setEditingVehicle(v); setVehicleDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-rose-400 bg-gray-900/80"
                          onClick={async () => {
                            if (window.confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) {
                              await base44.entities.Vehicle.delete(v.id);
                              setVehicles(prev => prev.filter(x => x.id !== v.id));
                            }
                          }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <VehicleTimeline vehicle={v} repairOrders={repairOrders} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Invoices */}
            <TabsContent value="invoices" className="mt-4">
              {invoices.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No invoices found.</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div key={inv.id}
                      onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                      <div>
                        <div className="font-semibold text-white">{inv.invoice_number || inv.id.slice(0,8)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.created_date)} · {inv.vehicle_info || "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{fmt(inv.total)}</span>
                        <Badge className={statusColors[inv.status] || "bg-gray-700 text-gray-300"}>{inv.status}</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Estimates */}
            <TabsContent value="estimates" className="mt-4">
              {estimates.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No estimates found.</div>
              ) : (
                <div className="space-y-2">
                  {estimates.map(est => (
                    <div key={est.id}
                      onClick={() => navigate(`/EstimateDetail/${est.id}`)}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                      <div>
                        <div className="font-semibold text-white">{est.estimate_number || est.id.slice(0,8)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDate(est.created_date)} · {est.vehicle_info || "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{fmt(est.grand_total)}</span>
                        <Badge className={statusColors[est.status] || "bg-gray-700 text-gray-300"}>{est.status}</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Appointments */}
            <TabsContent value="appointments" className="mt-4">
              {appointments.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No appointments found.</div>
              ) : (
                <div className="space-y-2">
                  {appointments.map(appt => (
                    <div key={appt.id}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{appt.service_type}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{appt.date} at {appt.time_slot} · {appt.vehicle_info || "—"}</div>
                        {appt.mechanic_name && <div className="text-xs text-gray-500 mt-0.5">Mechanic: {appt.mechanic_name}</div>}
                      </div>
                      <Badge className={statusColors[appt.status] || "bg-gray-700 text-gray-300"}>{appt.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              {/* Private Notes Log */}
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-300 text-sm font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Private Customer Notes
                  <span className="text-xs text-gray-600 font-normal ml-1">— only visible to shop staff</span>
                </div>
                <div className="space-y-2">
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a private note about this customer..."
                    className="bg-gray-800 border-gray-700 text-white min-h-[100px] resize-none"
                    rows={4}
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={addNote}
                      disabled={savingNote || !newNote.trim()}
                      className="bg-sky-600 hover:bg-sky-500"
                    >
                      {savingNote ? "Saving..." : "Add Note"}
                    </Button>
                  </div>
                </div>

                {/* Notes list */}
                {(customer?.notes_log || []).length === 0 ? (
                  <div className="text-gray-600 text-sm text-center py-4">No notes yet.</div>
                ) : (
                  <div className="space-y-2 pt-1">
                    {(customer.notes_log || []).map((note, idx) => (
                      <div key={idx} className="flex gap-3 rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white whitespace-pre-wrap">{note.text}</p>
                          <p className="text-xs text-gray-600 mt-1">{new Date(note.created_at).toLocaleString()}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-rose-400 flex-shrink-0"
                          onClick={() => deleteNote(idx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Edit Customer Dialog */}
      {customer && (
        <CustomerFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          customer={customer}
          onSaved={() => { setEditOpen(false); reload(); queryClient.invalidateQueries({ queryKey: ["customers"] }); }}
          onQuickAction={() => {}}
        />
      )}

      {/* New Repair Order Dialog */}
      {customer && (
        <RepairOrderFormDialog
          open={roOpen}
          onClose={() => setRoOpen(false)}
          order={{ customer_id: customer.id, customer_name: customer.full_name }}
          onSaved={() => { setRoOpen(false); reload(); }}
          customers={[customer]}
          vehicles={vehicles}
          mechanics={mechanics}
          parts={[]}
        />
      )}

      {/* New Appointment Dialog */}
      {customer && (
        <AppointmentFormDialog
          open={apptOpen}
          onClose={() => setApptOpen(false)}
          appointment={{ _prefillCustomerId: customer.id, _prefillCustomerName: customer.full_name }}
          onSaved={() => { setApptOpen(false); reload(); }}
          customers={[customer]}
          vehicles={vehicles}
          mechanics={mechanics}
        />
      )}

      {/* New Estimate Dialog */}
      {customer && (
        <EstimateFormDialog
          open={estimateOpen}
          onClose={() => setEstimateOpen(false)}
          estimate={{ customer_id: customer.id, customer_name: customer.full_name }}
          onSaved={() => { setEstimateOpen(false); reload(); }}
          customers={[customer]}
          vehicles={vehicles}
          parts={[]}
        />
      )}

      {/* Vehicle Add/Edit Dialog */}
      {customer && (
        <VehicleFormDialog
          open={vehicleDialogOpen}
          onClose={() => { setVehicleDialogOpen(false); setEditingVehicle(null); }}
          vehicle={editingVehicle ? editingVehicle : { customer_id: customer.id, customer_name: customer.full_name }}
          onSaved={() => {
            setVehicleDialogOpen(false);
            setEditingVehicle(null);
            base44.entities.Vehicle.filter({ customer_id: customerId }).then(setVehicles);
          }}
          customers={[customer]}
        />
      )}
    </div>
  );
}