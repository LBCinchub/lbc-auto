import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone, Mail, MapPin, Car, Wrench, FileText, Lightbulb, Clock, Plus, Pencil, ChevronRight, Calendar, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "../shared/StatusBadge";
import VehicleFormDialog from "@/components/vehicles/VehicleFormDialog";
import SendSMSDialog from "./SendSMSDialog";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm uppercase tracking-wide">
        <Icon className="w-4 h-4" /> {title}
      </div>
      {children}
    </div>
  );
}

export default function CustomerProfileDialog({ customer, open, onClose, customers = [] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showVehicleDialog, setShowVehicleDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 200),
    enabled: open,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 200),
    enabled: open,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 200),
    enabled: open,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("-created_date", 200),
    enabled: open,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => base44.entities.Appointment.list("-date", 200),
    enabled: open,
  });

  const customerOrders = useMemo(() =>
    orders.filter(o => o.customer_id === customer?.id),
    [orders, customer]
  );

  const customerInvoices = useMemo(() =>
    invoices.filter(i => i.customer_id === customer?.id),
    [invoices, customer]
  );

  const customerVehicles = useMemo(() =>
    vehicles.filter(v => v.customer_id === customer?.id),
    [vehicles, customer]
  );

  const customerEstimates = useMemo(() =>
    estimates.filter(e => e.customer_id === customer?.id),
    [estimates, customer]
  );

  const customerAppointments = useMemo(() =>
    appointments.filter(a => a.customer_id === customer?.id),
    [appointments, customer]
  );

  const today = new Date().toISOString().split("T")[0];
  const upcomingAppointments = customerAppointments.filter(a => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastAppointments = customerAppointments.filter(a => a.date < today).sort((a, b) => b.date.localeCompare(a.date));

  // Simple recommendations based on order history
  const recommendations = useMemo(() => {
    const recs = [];
    const descriptions = customerOrders.map(o => (o.description || "").toLowerCase());
    if (!descriptions.some(d => d.includes("oil")))
      recs.push("Schedule an oil change — no recent oil service found.");
    if (!descriptions.some(d => d.includes("tire") || d.includes("wheel")))
      recs.push("Consider a tire rotation & balance check.");
    if (!descriptions.some(d => d.includes("brake")))
      recs.push("Brake inspection recommended if not done recently.");
    if (customerOrders.length === 0)
      recs.push("No repair history found. Schedule a full vehicle inspection.");
    return recs.slice(0, 3);
  }, [customerOrders]);

  const totalSpent = customerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  if (!customer) return null;

  return (
    <>
    <VehicleFormDialog
      open={showVehicleDialog}
      onClose={() => { setShowVehicleDialog(false); setEditingVehicle(null); }}
      vehicle={editingVehicle}
      customers={customers}
      onSaved={() => {
        queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        setShowVehicleDialog(false);
        setEditingVehicle(null);
      }}
    />
    <SendSMSDialog
      open={showSMSDialog}
      onClose={() => setShowSMSDialog(false)}
      customer={customer}
    />
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-lg">
              {customer.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-white text-lg font-bold">{customer.full_name}</p>
              <p className="text-gray-400 text-xs font-normal">Customer Profile</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-gray-800/50 border border-gray-700">
              <TabsTrigger value="history" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 text-xs sm:text-sm">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> History
              </TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 text-xs sm:text-sm">
                <Wrench className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Repairs
              </TabsTrigger>
              <TabsTrigger value="invoices" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 text-xs sm:text-sm">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="appointments" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 text-xs sm:text-sm">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Appointments
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400 text-xs sm:text-sm">
                <Car className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Vehicles
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Contact Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Phone className="w-4 h-4 text-sky-400 flex-shrink-0" /> {customer.phone}
                <button onClick={() => setShowSMSDialog(true)} title="Send SMS" className="ml-1 text-gray-500 hover:text-sky-400 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Mail className="w-4 h-4 text-sky-400 flex-shrink-0" /> {customer.email}
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <MapPin className="w-4 h-4 text-sky-400 flex-shrink-0" /> {customer.address}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-3 border-t border-gray-700 pt-3 mt-1">
              <span className="text-gray-500">Total Spent:</span>
              <span className="text-emerald-400 font-semibold">${totalSpent.toFixed(2)}</span>
              <span className="text-gray-500 ml-4">Repairs:</span>
              <span className="text-white font-semibold">{customerOrders.length}</span>
              <span className="text-gray-500 ml-4">Vehicles:</span>
              <span className="text-white font-semibold">{customerVehicles.length}</span>
            </div>
          </div>

          {/* History Tab */}
          {activeTab === "history" && (
           <div className="space-y-4">
             <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
               <div className="grid grid-cols-3 gap-4 mb-4">
                 <div>
                   <p className="text-gray-500 text-xs uppercase tracking-wide">Total Spending</p>
                   <p className="text-emerald-400 font-bold text-xl mt-1">${totalSpent.toFixed(2)}</p>
                 </div>
                 <div>
                   <p className="text-gray-500 text-xs uppercase tracking-wide">Total Invoices</p>
                   <p className="text-sky-400 font-bold text-xl mt-1">{customerInvoices.length}</p>
                 </div>
                 <div>
                   <p className="text-gray-500 text-xs uppercase tracking-wide">Total Estimates</p>
                   <p className="text-purple-400 font-bold text-xl mt-1">{customerEstimates.length}</p>
                 </div>
               </div>
               {customerInvoices.length > 0 && (
                 <div className="pt-3 border-t border-gray-700">
                   <p className="text-gray-500 text-xs">Average Invoice Value</p>
                   <p className="text-amber-400 font-semibold text-lg">${(totalSpent / customerInvoices.length).toFixed(2)}</p>
                 </div>
               )}
             </div>

             <div>
               <h3 className="text-sky-400 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                 <Clock className="w-4 h-4" /> Chronological Timeline
               </h3>
               {(() => {
                 const timeline = [
                   ...customerInvoices.map(inv => ({
                     id: inv.id,
                     type: 'invoice',
                     date: inv.created_date,
                     number: inv.invoice_number || inv.id.slice(0, 6),
                     amount: inv.total,
                     status: inv.status,
                     vehicle: inv.vehicle_info
                   })),
                   ...customerEstimates.map(est => ({
                     id: est.id,
                     type: 'estimate',
                     date: est.created_date,
                     number: est.estimate_number || est.id.slice(0, 6),
                     amount: est.grand_total,
                     status: est.status,
                     vehicle: est.vehicle_info
                   }))
                 ].sort((a, b) => new Date(b.date) - new Date(a.date));

                 if (timeline.length === 0) {
                   return <p className="text-gray-500 text-sm">No invoices or estimates found.</p>;
                 }

                 return (
                   <div className="space-y-2">
                     {timeline.map((item, idx) => (
                       <button
                         key={item.id}
                         onClick={() => {
                           onClose();
                           if (item.type === 'invoice') {
                             navigate(`/InvoiceDetail/${item.id}`);
                           } else {
                             navigate(`/EstimateDetail/${item.id}`);
                           }
                         }}
                         className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left group"
                       >
                         <div className="flex items-start gap-3 min-w-0 flex-1">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.type === 'invoice' ? 'bg-emerald-500/20' : 'bg-purple-500/20'}`}>
                             <FileText className={`w-3.5 h-3.5 ${item.type === 'invoice' ? 'text-emerald-400' : 'text-purple-400'}`} />
                           </div>
                           <div className="min-w-0 flex-1">
                             <div className="flex items-center gap-2">
                               <p className="text-white text-sm font-medium">
                                 {item.type === 'invoice' ? 'Invoice' : 'Estimate'} #{item.number}
                               </p>
                               <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                 item.type === 'invoice' 
                                   ? item.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'
                                   : item.status === 'approved' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-300'
                               }`}>
                                 {item.status}
                               </span>
                             </div>
                             <p className="text-gray-500 text-xs mt-0.5">{item.vehicle || '—'}</p>
                             <p className="text-gray-600 text-xs mt-1">
                               {new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </p>
                           </div>
                         </div>
                         <div className="flex items-center gap-2 flex-shrink-0">
                           <span className="text-emerald-400 font-semibold text-sm">${(item.amount || 0).toFixed(2)}</span>
                           <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
                         </div>
                       </button>
                     ))}
                   </div>
                 );
               })()}
             </div>
           </div>
          )}

          {/* Vehicles Tab */}
          {activeTab === "vehicles" && (
           <Section icon={Car} title="Vehicles">
            <div className="flex justify-end mb-2">
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white gap-1"
                onClick={() => { setEditingVehicle({ customer_id: customer.id, customer_name: customer.full_name }); setShowVehicleDialog(true); }}>
                <Plus className="w-3.5 h-3.5" /> Add Vehicle
              </Button>
            </div>
            {customerVehicles.length === 0 ? (
              <p className="text-gray-500 text-sm">No vehicles on file.</p>
            ) : (
              <div className="space-y-2">
                {customerVehicles.map(v => (
                  <div key={v.id} className="bg-gray-800/60 rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
                    <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium">{v.year} {v.make} {v.model}</span>
                      {v.license_plate && <span className="text-gray-500"> · {v.license_plate}</span>}
                      {v.color && <span className="text-gray-500"> · {v.color}</span>}
                      {v.vin && <p className="text-gray-600 text-xs mt-0.5">VIN: {v.vin}</p>}
                    </div>
                    <button
                      onClick={() => { setEditingVehicle(v); setShowVehicleDialog(true); }}
                      className="text-gray-500 hover:text-sky-400 transition-colors flex-shrink-0"
                      title="Edit vehicle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </Section>
            )}

            {/* Repair History Tab */}
            {activeTab === "orders" && (
            <Section icon={Wrench} title="Repair History">
            {customerOrders.length === 0 ? (
              <p className="text-gray-500 text-sm">No repair orders found.</p>
            ) : (
              <div className="space-y-2">
                {customerOrders.map(o => (
                  <button key={o.id}
                    onClick={() => { onClose(); navigate(`/RepairOrderDetail/${o.id}`); }}
                    className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Wrench className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{o.description}</p>
                        <p className="text-gray-500 text-xs">{o.vehicle_info} · #{o.order_number || o.id?.slice(0,6)}</p>
                        {o.created_date && (
                          <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(o.created_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        {o.total_cost > 0 && (
                          <span className="text-emerald-400 text-xs font-semibold">${o.total_cost.toFixed(2)}</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            </Section>
            )}

            {/* Estimates Tab */}
            {activeTab === "orders" && (
            <Section icon={FileText} title="Estimates">
            {customerEstimates.length === 0 ? (
              <p className="text-gray-500 text-sm">No estimates found.</p>
            ) : (
              <div className="space-y-2">
                {customerEstimates.map(est => (
                  <button key={est.id}
                    onClick={() => { onClose(); navigate(`/EstimateDetail/${est.id}`); }}
                    className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">#{est.estimate_number || est.id?.slice(0,6)}</p>
                        <p className="text-gray-500 text-xs">{est.vehicle_info}</p>
                        {est.created_date && (
                          <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(est.created_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={est.status} />
                        {est.grand_total > 0 && (
                          <span className="text-emerald-400 text-xs font-semibold">${(est.grand_total || 0).toFixed(2)}</span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            </Section>
            )}

            {/* Invoices Tab */}
            {activeTab === "invoices" && (
            <Section icon={FileText} title="Invoices">
            {customerInvoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices found.</p>
            ) : (
              <div className="space-y-2">
                {customerInvoices.map(inv => (
                  <button key={inv.id}
                    onClick={() => { onClose(); navigate(`/InvoiceDetail/${inv.id}`); }}
                    className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">#{inv.invoice_number || inv.id?.slice(0,6)}</p>
                        <p className="text-gray-500 text-xs">{inv.vehicle_info}</p>
                        {inv.created_date && (
                          <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(inv.created_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={inv.status} />
                        <span className="text-emerald-400 text-xs font-semibold">${(inv.total || 0).toFixed(2)}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            </Section>
            )}

            {/* Appointments Tab */}
            {activeTab === "appointments" && (
            <div className="space-y-2">
            {/* Upcoming */}
            {upcomingAppointments.length > 0 && (
              <div>
                <h3 className="text-sky-400 font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Upcoming
                </h3>
                <div className="space-y-2 mb-4">
                  {upcomingAppointments.map(appt => (
                    <button key={appt.id}
                      onClick={() => { onClose(); navigate(`/Appointments?appointmentId=${appt.id}`); }}
                      className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left border border-green-500/20">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-green-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium">{appt.service_type}</p>
                          <p className="text-gray-500 text-xs">{appt.vehicle_info}</p>
                          <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(appt.date + "T12:00:00").toLocaleDateString()} at {appt.time_slot}
                          </p>
                          {appt.mechanic_name && <p className="text-gray-600 text-xs">Mechanic: {appt.mechanic_name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={appt.status} />
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {pastAppointments.length > 0 && (
              <div>
                <h3 className="text-gray-400 font-semibold text-sm uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Past
                </h3>
                <div className="space-y-2">
                  {pastAppointments.slice(0, 5).map(appt => (
                    <button key={appt.id}
                      onClick={() => { onClose(); navigate(`/Appointments?appointmentId=${appt.id}`); }}
                      className="w-full bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3 hover:bg-gray-700/60 transition-colors text-left opacity-75">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium">{appt.service_type}</p>
                          <p className="text-gray-500 text-xs">{appt.vehicle_info}</p>
                          <p className="text-gray-600 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(appt.date + "T12:00:00").toLocaleDateString()} at {appt.time_slot}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  ))}
                  {pastAppointments.length > 5 && (
                    <p className="text-gray-500 text-xs text-center py-2">+{pastAppointments.length - 5} more past appointments</p>
                  )}
                </div>
              </div>
            )}

            {customerAppointments.length === 0 && (
              <p className="text-gray-500 text-sm">No appointments found.</p>
            )}
            </div>
            )}

            {/* Recommendations */}
            {activeTab === "orders" && (
            <Section icon={Lightbulb} title="Recommendations">
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-sm text-amber-300">
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {rec}
                </div>
              ))}
            </div>
            </Section>
            )}

            {/* Quick Actions */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Quick Actions</p>
            <div className="grid grid-cols-5 gap-2">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/Estimates?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <FileText className="w-4 h-4" />
                <span className="text-xs">Estimate</span>
              </Button>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/RepairOrders?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <Wrench className="w-4 h-4" />
                <span className="text-xs">Repair Order</span>
              </Button>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/Invoices?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <FileText className="w-4 h-4" />
                <span className="text-xs">Invoice</span>
              </Button>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/Appointments?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Appointment</span>
              </Button>
              {customer?.phone && (
                <Button className="bg-emerald-700 hover:bg-emerald-600 text-white flex flex-col h-auto py-3 gap-1"
                  onClick={() => setShowSMSDialog(true)}>
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-xs">Send SMS</span>
                </Button>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}