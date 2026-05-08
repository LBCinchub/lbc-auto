import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Car, Calendar,
  ClipboardList, Pencil, Wrench, ChevronRight
} from "lucide-react";
import { formatPhone } from "@/utils/formatPhone";
import CustomerFormDialog from "../components/customers/CustomerFormDialog";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";
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
  const [mechanics, setMechanics] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [roOpen, setRoOpen] = useState(false);

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
    ]).then(([customers, veh, inv, est, appt, mech, allVeh]) => {
      setCustomer(customers[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
      setMechanics(mech);
      setAllVehicles(allVeh);
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
    ]).then(([customers, veh, inv, est, appt]) => {
      setCustomer(customers[0] || null);
      setVehicles(veh);
      setInvoices(inv);
      setEstimates(est);
      setAppointments(appt);
    }).finally(() => setLoading(false));
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-CA") : "—";
  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

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
  };

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
                  {customer.notes && (
                    <p className="mt-2 text-sm text-gray-500 italic">{customer.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}
                  className="border-gray-700 text-gray-300 hover:text-white gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button size="sm" onClick={() => setRoOpen(true)}
                  className="bg-sky-600 hover:bg-sky-500 gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> New Repair Order
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="vehicles">
            <TabsList className="bg-gray-900 border border-gray-800">
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
            </TabsList>

            {/* Vehicles */}
            <TabsContent value="vehicles" className="mt-4">
              {vehicles.length === 0 ? (
                <div className="text-gray-500 text-sm py-8 text-center">No vehicles on file.</div>
              ) : (
                <div className="space-y-3">
                  {vehicles.map(v => (
                    <div key={v.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                        <Car className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white capitalize">{v.year} {v.make} {v.model}</div>
                        <div className="flex gap-3 mt-0.5 flex-wrap">
                          {v.license_plate && <span className="text-xs text-gray-400 font-mono">Plate: {v.license_plate}</span>}
                          {v.vin && <span className="text-xs text-gray-500 font-mono">VIN: {v.vin}</span>}
                          {v.color && <span className="text-xs text-gray-400">Color: {v.color}</span>}
                          {v.mileage && <span className="text-xs text-gray-400">{v.mileage.toLocaleString()} km</span>}
                        </div>
                      </div>
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
    </div>
  );
}