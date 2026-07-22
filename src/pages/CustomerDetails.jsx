import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { propagateCustomerUpdate } from "@/utils/syncCustomerActivity";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Car, ChevronRight,
  ClipboardList, Pencil, Wrench, DollarSign,
  Clock, Plus, StickyNote, CalendarPlus, Trash2, Lock, Printer, Loader2, Camera, AlertTriangle
} from "lucide-react";
import { formatPhone } from "@/utils/formatPhone";
import CustomerFormDialog from "../components/customers/CustomerFormDialog";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";
import AppointmentFormDialog from "../components/appointments/AppointmentFormDialog";
import EstimateFormDialog from "../components/estimates/EstimateFormDialog";
import VehicleFormDialog from "../components/vehicles/VehicleFormDialog";
import VehiclePhotosTab from "@/components/photos/VehiclePhotosTab";
import VehicleHistoryReport from "@/components/reports/VehicleHistoryReport";
import { useQueryClient } from "@tanstack/react-query";
import AutoAIBubble from "@/components/shared/AutoAIBubble";
import InvoiceLinkGuard from "@/components/customers/InvoiceLinkGuard";

const AVATAR_COLORS = ["bg-sky-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-indigo-500"];
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
  invoiced: "bg-emerald-500/20 text-emerald-400",
};

function VehicleTimeline({ vehicle, repairOrders, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const vehicleOrders = repairOrders
    .filter(ro => ro.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const totalSpent = vehicleOrders.reduce((sum, ro) => sum + (ro.total_cost || 0), 0);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="px-4 pt-4 pb-3 bg-gray-800/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Car className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-base capitalize">
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown Vehicle"}
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5 items-center">
              {vehicle.color && <span className="text-xs text-gray-300 bg-gray-700/60 px-2 py-0.5 rounded-full capitalize">● {vehicle.color}</span>}
              {vehicle.license_plate && <span className="text-xs font-mono font-bold text-white bg-blue-900/40 border border-blue-700/40 px-2 py-0.5 rounded tracking-widest">🪪 {vehicle.license_plate.toUpperCase()}</span>}
              {vehicle.engine_type && <span className="text-xs text-amber-300 bg-amber-900/20 px-2 py-0.5 rounded-full">⚙ {vehicle.engine_type}</span>}
            </div>
            {vehicle.vin && <div className="mt-1.5 font-mono text-xs text-gray-400 bg-gray-900/60 rounded px-2 py-1 tracking-wider">VIN: <span className="text-gray-200 font-semibold uppercase">{vehicle.vin}</span></div>}
            {vehicle.mileage && <div className="text-xs text-gray-500 mt-1">🛣 {Number(vehicle.mileage).toLocaleString()} km</div>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {vehicleOrders.length > 0 && (
              <>
                <div className="text-right"><div className="text-xs text-gray-500">Spent</div><div className="text-sm font-bold text-emerald-400">${totalSpent.toFixed(0)}</div></div>
                <div className="text-right"><div className="text-xs text-gray-500">Jobs</div><div className="text-sm font-bold text-white">{vehicleOrders.length}</div></div>
              </>
            )}
            <button onClick={() => setOpen(v => !v)} className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              {open ? "Hide history" : "Show history"}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-gray-800">
          {vehicleOrders.length === 0 ? (
            <div className="text-gray-600 text-sm py-6 text-center">No repair history for this vehicle.</div>
          ) : (
            <div className="p-4 space-y-2">
              {vehicleOrders.map(ro => (
                <div key={ro.id} onClick={() => window.location.href = `/RepairOrderDetail/${ro.id}`}
                  className="rounded-lg border border-gray-800 bg-gray-800/30 p-3 cursor-pointer hover:border-sky-500/40 hover:bg-gray-800/60 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{ro.description || "Repair Order"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{new Date(ro.created_date).toLocaleDateString("en-CA")}{ro.order_number && <span className="ml-2 text-gray-600">#{ro.order_number}</span>}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ro.total_cost > 0 && <span className="text-sm font-bold text-white">${(ro.total_cost || 0).toFixed(2)}</span>}
                      <Badge className={`${statusColors[ro.status] || "bg-gray-700 text-gray-300"} text-xs capitalize border-0`}>{ro.status?.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [roOpen, setRoOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
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
      base44.entities.RepairOrder.filter({ customer_id: customerId }),
      base44.entities.VehiclePhoto.filter({ customer_id: customerId }),
      base44.auth.me().catch(() => null),
    ]).then(([custs, veh, inv, est, appt, mech, ros, photos, me]) => {
      setCustomer(custs[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
      setMechanics(mech);
      setRepairOrders(ros);
      setVehiclePhotos(photos);
      setCurrentUser(me);
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
      base44.entities.VehiclePhoto.filter({ customer_id: customerId }),
    ]).then(([custs, veh, inv, est, appt, ros, photos]) => {
      setCustomer(custs[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
      setRepairOrders(ros);
      setVehiclePhotos(photos);
    }).finally(() => setLoading(false));
  };

  const refetchPhotos = () => {
    base44.entities.VehiclePhoto.filter({ customer_id: customerId }).then(setVehiclePhotos).catch(() => {});
  };

  const handleEmailReport = async () => {
    if (!customer?.email) { setEmailResult({ ok: false, msg: "No email on file for this customer." }); return; }
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await base44.functions.invoke("sendVehicleHistoryReport", { customer_id: customerId, to: customer.email });
      if (res?.data?.success || res?.success) {
        setEmailResult({ ok: true, msg: `✅ Report emailed to ${customer.email}` });
      } else {
        setEmailResult({ ok: false, msg: res?.data?.error || res?.error || "Failed to send email." });
      }
    } catch (e) {
      setEmailResult({ ok: false, msg: e?.message || "Failed to send email." });
    }
    setEmailSending(false);
    setTimeout(() => setEmailResult(null), 5000);
  };

  const addNote = async () => {
    if (!newNote.trim() || !customer) return;
    setSavingNote(true);
    const entry = { text: newNote.trim(), created_at: new Date().toISOString(), author: currentUser?.email || "" };
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

  const totalSpend = invoices
    .filter(inv => inv.status === "paid" || inv.amount_paid > 0)
    .reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || parseFloat(inv.total) || 0), 0);

  const lastVisitDate = customer?.last_visit
    ? new Date(customer.last_visit)
    : repairOrders.length > 0
      ? repairOrders.reduce((latest, ro) => { const d = new Date(ro.created_date); return d > latest ? d : latest; }, new Date(0))
      : null;

  const daysSinceLastVisit = lastVisitDate && lastVisitDate.getTime() > 0
    ? Math.floor((new Date() - lastVisitDate) / (1000 * 60 * 60 * 24))
    : null;

  // Deduplicated vehicles from invoice records
  const allVehicleInfos = [...new Set([
    ...invoices.map(i => i.vehicle_info).filter(Boolean),
    ...vehicles.map(v => [v.year, v.make, v.model].filter(Boolean).join(" ")).filter(Boolean),
  ])].filter(v => v && v.trim() !== "—" && v.trim() !== "");

  if (!customerId) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No customer selected.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
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
          {/* ── HEADER CARD ── */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(customer.full_name)}`}>
                  <span className="text-white font-bold text-xl">{customer.full_name?.charAt(0)?.toUpperCase()}</span>
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
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-semibold">{fmt(totalSpend)}</span>
                      <span className="text-gray-500 text-xs">total spent</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-sky-400">
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span className="font-semibold">{customer.total_visits || invoices.length || 0}</span>
                      <span className="text-gray-500 text-xs">visits</span>
                    </div>
                    {daysSinceLastVisit !== null && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold">{daysSinceLastVisit === 0 ? "Today" : `${daysSinceLastVisit}d ago`}</span>
                        <span className="text-gray-500 text-xs">last visit</span>
                      </div>
                    )}
                    {customer.last_vehicle_info && (
                      <div className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Car className="w-3.5 h-3.5" />
                        <span className="capitalize">{customer.last_vehicle_info}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}
                  className="border-gray-700 text-gray-300 hover:text-white gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={handleEmailReport} disabled={emailSending}
                  className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 gap-1.5">
                  {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {emailSending ? "Sending..." : "Email Report"}
                </Button>
                {emailResult && (
                  <span className={`text-xs ${emailResult.ok ? "text-emerald-400" : "text-rose-400"}`}>{emailResult.msg}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button onClick={async () => { const v = await base44.entities.Vehicle.filter({ customer_id: customerId }); setVehicles(v); setApptOpen(true); }}
              variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 gap-2">
              <CalendarPlus className="w-4 h-4" /> New Appointment
            </Button>
            <Button onClick={async () => { const v = await base44.entities.Vehicle.filter({ customer_id: customerId }); setVehicles(v); setRoOpen(true); }}
              variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 gap-2">
              <Wrench className="w-4 h-4" /> New Repair Order
            </Button>
            <Button onClick={async () => { const v = await base44.entities.Vehicle.filter({ customer_id: customerId }); setVehicles(v); setEstimateOpen(true); }}
              variant="outline" className="border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 gap-2">
              <ClipboardList className="w-4 h-4" /> New Estimate
            </Button>
            <Button onClick={() => navigate(`/Invoices?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`)}
              variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 gap-2">
              <FileText className="w-4 h-4" /> New Invoice
            </Button>
          </div>

          {/* ── TABS: Estimates / Repair Orders / Invoices ── */}
          <Tabs defaultValue="estimates">
            <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="estimates" className="gap-1.5 data-[state=active]:bg-gray-800">
                <ClipboardList className="w-3.5 h-3.5" /> Estimates ({estimates.length})
              </TabsTrigger>
              <TabsTrigger value="repairorders" className="gap-1.5 data-[state=active]:bg-gray-800">
                <Wrench className="w-3.5 h-3.5" /> Repair Orders ({repairOrders.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-1.5 data-[state=active]:bg-gray-800">
                <FileText className="w-3.5 h-3.5" /> Invoices ({invoices.length})
              </TabsTrigger>
            </TabsList>

            {/* Estimates Tab */}
            <TabsContent value="estimates" className="mt-4">
              {estimates.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No estimates found for this customer.</div>
              ) : (
                <div className="space-y-2">
                  {estimates.map(est => (
                    <div key={est.id} onClick={() => navigate(`/EstimateDetail/${est.id}`)}
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

            {/* Repair Orders Tab */}
            <TabsContent value="repairorders" className="mt-4">
              {repairOrders.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No repair orders found for this customer.</div>
              ) : (
                <div className="space-y-2">
                  {repairOrders.map(ro => (
                    <div key={ro.id} onClick={() => navigate(`/RepairOrderDetail/${ro.id}`)}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                      <div>
                        <div className="font-semibold text-white">{ro.order_number || ro.id.slice(0,8)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDate(ro.created_date)} · {ro.description?.slice(0, 50) || "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{fmt(ro.total_cost)}</span>
                        <Badge className={statusColors[ro.status] || "bg-gray-700 text-gray-300"}>{ro.status?.replace(/_/g, " ")}</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="mt-4">
              {invoices.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No invoices found for this customer.</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div key={inv.id} onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
                      className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{inv.invoice_number || inv.id.slice(0,8)}</span>
                          {(inv.status === "unpaid" || inv.status === "partial" || inv.status === "overdue") && (
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.created_date)} · {inv.vehicle_info || "—"}</div>
                        <InvoiceLinkGuard invoice={inv} vehicles={vehicles} repairOrders={repairOrders} onRelink={reload} />
                        </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white">{fmt(inv.total)}</span>
                        {(inv.status === "partial" || inv.status === "unpaid") && inv.balance_due > 0 && (
                          <span className="text-sm font-bold text-yellow-400">{fmt(inv.balance_due)}</span>
                        )}
                        <Badge className={statusColors[inv.status] || "bg-gray-700 text-gray-300"}>{inv.status}</Badge>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ── NOTES SECTION ── */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-sm font-semibold text-gray-300">Private Customer Notes</span>
              <span className="text-xs text-gray-600 ml-1">— shop staff only, never shown to customer</span>
            </div>
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note about this customer..."
                className="bg-gray-800 border-gray-700 text-white min-h-[100px] resize-none"
                rows={4}
              />
              <div className="flex justify-end">
                <Button onClick={addNote} disabled={savingNote || !newNote.trim()} className="bg-sky-600 hover:bg-sky-500">
                  {savingNote ? "Saving..." : "Add Note"}
                </Button>
              </div>
            </div>
            {(customer.notes_log || []).length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-4 border-t border-gray-800 pt-4">No notes yet. Add your first note above.</div>
            ) : (
              <div className="space-y-2 border-t border-gray-800 pt-4">
                {(customer.notes_log || []).map((note, idx) => (
                  <div key={idx} className="flex gap-3 rounded-lg border border-gray-800 bg-gray-800/40 p-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white whitespace-pre-wrap">{note.text}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(note.created_at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
                        {note.author && <span className="ml-2">· {note.author}</span>}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-rose-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteNote(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── VEHICLE HISTORY ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Car className="w-4 h-4 text-sky-400" /> Vehicle History ({vehicles.length})
              </h2>
              <Button size="sm" variant="outline"
                className="border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 h-8 gap-1.5 text-xs"
                onClick={() => { setEditingVehicle(null); setVehicleDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Add Vehicle
              </Button>
            </div>
            {vehicles.length === 0 ? (
              <div className="text-gray-500 text-sm py-8 text-center border border-gray-800 rounded-lg bg-gray-900/30">
                No vehicles on file.
                {allVehicleInfos.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-600">Vehicles referenced in invoices:</p>
                    {allVehicleInfos.map((v, i) => (
                      <p key={i} className="text-xs text-gray-400 capitalize">{v}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map(v => (
                  <div key={v.id} className="relative group">
                    <div className="absolute top-3 right-10 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white hover:bg-gray-700"
                        onClick={e => { e.stopPropagation(); setEditingVehicle(v); setVehicleDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={async e => { e.stopPropagation(); if (window.confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) { await base44.entities.Vehicle.delete(v.id); setVehicles(prev => prev.filter(x => x.id !== v.id)); } }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <VehicleTimeline vehicle={v} repairOrders={repairOrders} defaultOpen={vehicles.length === 1} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── APPOINTMENTS ── */}
          {appointments.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
                <CalendarPlus className="w-4 h-4 text-sky-400" /> Appointments ({appointments.length})
              </h2>
              <div className="space-y-2">
                {appointments.map(appt => (
                  <div key={appt.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{appt.service_type}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{appt.date} at {appt.time_slot} · {appt.vehicle_info || "—"}</div>
                    </div>
                    <Badge className={statusColors[appt.status] || "bg-gray-700 text-gray-300"}>{appt.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VEHICLE PHOTOS ── */}
          {vehiclePhotos.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-sky-400" /> Photos ({vehiclePhotos.length})
              </h2>
              <VehiclePhotosTab photos={vehiclePhotos} repairOrders={repairOrders} estimates={estimates} onRefetch={refetchPhotos} />
            </div>
          )}

          {/* Printable Vehicle History Report */}
          {customer && (
            <VehicleHistoryReport
              customer={customer}
              vehicles={vehicles}
              invoices={invoices}
              repairOrders={repairOrders}
              vehiclePhotos={vehiclePhotos}
              shopName={currentUser?.business_name || ""}
              shopLogo={currentUser?.logo_url || ""}
            />
          )}
        </>
      )}

      {/* Edit Customer Dialog */}
      {customer && (
        <CustomerFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          customer={customer}
          onSaved={async (updatedCustomer) => {
            if (customer?.id) {
              const fresh = updatedCustomer || customer;
              await propagateCustomerUpdate(customer.id, {
                full_name: fresh.full_name,
                phone: fresh.phone,
                email: fresh.email,
              }).catch(() => {});
            }
            setEditOpen(false); reload(); queryClient.invalidateQueries({ queryKey: ["customers"] });
          }}
          onQuickAction={() => {}}
        />
      )}

      {/* New Repair Order Dialog */}
      {customer && roOpen && (
        <RepairOrderFormDialog
          open={roOpen}
          onClose={() => setRoOpen(false)}
          order={{ customer_id: customer.id, customer_name: customer.full_name, vehicle_id: vehicles.length === 1 ? vehicles[0].id : "", vehicle_info: vehicles.length === 1 ? `${vehicles[0].year} ${vehicles[0].make} ${vehicles[0].model}` : "" }}
          onSaved={() => { setRoOpen(false); reload(); }}
          customers={[customer]}
          vehicles={vehicles}
          mechanics={mechanics}
          parts={[]}
        />
      )}

      {/* New Appointment Dialog */}
      {customer && apptOpen && (
        <AppointmentFormDialog
          open={apptOpen}
          onClose={() => setApptOpen(false)}
          appointment={{
            customer_id: customer.id,
            _prefillCustomerId: customer.id,
            _prefillCustomerName: customer.full_name,
            customer_name: customer.full_name,
          }}
          onSaved={() => { setApptOpen(false); reload(); }}
          customers={[customer]}
          vehicles={vehicles}
          mechanics={mechanics}
        />
      )}

      {/* New Estimate Dialog */}
      {customer && estimateOpen && (
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
          onSaved={async () => {
            setVehicleDialogOpen(false);
            setEditingVehicle(null);
            const freshVehicles = await base44.entities.Vehicle.filter({ customer_id: customerId });
            setVehicles(freshVehicles);
          }}
          customers={[customer]}
        />
      )}
      <AutoAIBubble />
    </div>
  );
}