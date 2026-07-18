import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Wrench, FileText, Phone, Hash, Car,
  ClipboardList, Calendar, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AutoAIBubble from "@/components/shared/AutoAIBubble";

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

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-CA") : "—";
const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

export default function VehicleTimeline() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => base44.entities.Vehicle.get(vehicleId),
    enabled: !!vehicleId,
  });

  const { data: repairOrders = [] } = useQuery({
    queryKey: ["vehicle-repairOrders", vehicleId],
    queryFn: () => base44.entities.RepairOrder.filter({ vehicle_id: vehicleId }, "-created_date", 100),
    enabled: !!vehicleId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["vehicle-invoices", vehicleId],
    queryFn: () => base44.entities.Invoice.filter({ vehicle_id: vehicleId }, "-created_date", 100),
    enabled: !!vehicleId,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["vehicle-estimates", vehicleId],
    queryFn: () => base44.entities.Estimate.filter({ vehicle_id: vehicleId }, "-created_date", 100),
    enabled: !!vehicleId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["vehicle-appointments", vehicleId],
    queryFn: () => base44.entities.Appointment.filter({ vehicle_id: vehicleId }, "-created_date", 100),
    enabled: !!vehicleId,
  });

  // Build timeline from repair orders + invoices
  const timelineEvents = [
    ...repairOrders.map(order => ({ type: "repair", date: new Date(order.created_date), data: order })),
    ...invoices.map(invoice => ({ type: "invoice", date: new Date(invoice.created_date), data: invoice })),
  ].sort((a, b) => b.date - a.date);

  if (vehicleLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/Vehicles")} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Vehicle not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/Vehicles")} className="text-gray-400 hover:text-white gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to Vehicles
      </Button>

      {/* Vehicle Header */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <h1 className="text-2xl font-bold text-white mb-1">{vehicle.year} {vehicle.make} {vehicle.model}</h1>
        {vehicle.color && <p className="text-gray-500 text-sm mb-4">{vehicle.color}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {vehicle.customer_name && (
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Owner</span>
              <button
                onClick={() => vehicle.customer_id && navigate(`/CustomerDetails?id=${vehicle.customer_id}`)}
                className="text-sky-400 hover:text-sky-300 hover:underline font-medium transition-colors text-left"
              >
                {vehicle.customer_name} →
              </button>
            </div>
          )}
          {vehicle.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Phone</span>
              <a href={`tel:${vehicle.phone}`} className="text-sky-400 hover:text-sky-300 font-medium">{vehicle.phone}</a>
            </div>
          )}
          {vehicle.license_plate && (
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Plate</span>
              <span className="text-white font-mono font-medium">{vehicle.license_plate}</span>
            </div>
          )}
          {vehicle.vin && (
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">VIN</span>
              <span className="text-white font-mono text-xs">{vehicle.vin}</span>
            </div>
          )}
          {vehicle.mileage > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Mileage</span>
              <span className="text-white">{vehicle.mileage?.toLocaleString()} mi</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="history">
        <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-gray-800">
            <Wrench className="w-3.5 h-3.5" /> Service History ({timelineEvents.length})
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

        {/* Service History Tab */}
        <TabsContent value="history" className="mt-4">
          <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
            {timelineEvents.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No service history for this vehicle yet.</p>
            ) : (
              <div className="space-y-4">
                {timelineEvents.map((event, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        event.type === "repair"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {event.type === "repair" ? <Wrench className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      {idx < timelineEvents.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-800 my-2" />
                      )}
                    </div>

                    <div className="flex-1 pb-4">
                      <div
                        className="bg-gray-800/30 rounded-lg p-4 border border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors"
                        onClick={() => event.type === "repair"
                          ? navigate(`/RepairOrderDetail/${event.data.id}`)
                          : navigate(`/InvoiceDetail/${event.data.id}`)
                        }
                      >
                        {event.type === "repair" ? (
                          <>
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-white">Repair Order #{event.data.order_number}</h3>
                              <span className="text-xs text-gray-500">
                                {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm mb-2">{event.data.description}</p>
                            <div className="flex gap-4 text-xs text-gray-400">
                              {event.data.mechanic_name && <span>Mechanic: {event.data.mechanic_name}</span>}
                              {event.data.status && (
                                <Badge className={statusColors[event.data.status] || "bg-gray-700 text-gray-300"}>
                                  {event.data.status?.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            {event.data.total_cost > 0 && (
                              <p className="text-white font-semibold mt-2">Total: {fmt(event.data.total_cost)}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-white">Invoice #{event.data.invoice_number}</h3>
                              <span className="text-xs text-gray-500">
                                {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <div className="flex gap-4 text-xs mb-2">
                              <Badge className={statusColors[event.data.status] || "bg-gray-700 text-gray-300"}>
                                {event.data.status}
                              </Badge>
                            </div>
                            <p className="text-white font-semibold">Total: {fmt(event.data.total)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <div className="text-gray-500 text-sm py-8 text-center">No invoices for this vehicle yet.</div>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <div key={inv.id}
                  onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                  <div>
                    <div className="font-semibold text-white">{inv.invoice_number || inv.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.created_date)}</div>
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

        {/* Estimates Tab */}
        <TabsContent value="estimates" className="mt-4">
          {estimates.length === 0 ? (
            <div className="text-gray-500 text-sm py-8 text-center">No estimates for this vehicle yet.</div>
          ) : (
            <div className="space-y-2">
              {estimates.map(est => (
                <div key={est.id}
                  onClick={() => navigate(`/EstimateDetail/${est.id}`)}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between cursor-pointer hover:border-sky-500/30 hover:bg-gray-800/50 transition-all">
                  <div>
                    <div className="font-semibold text-white">{est.estimate_number || est.id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(est.created_date)}</div>
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

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="mt-4">
          {appointments.length === 0 ? (
            <div className="text-gray-500 text-sm py-8 text-center">No appointments for this vehicle yet.</div>
          ) : (
            <div className="space-y-2">
              {appointments.map(appt => (
                <div key={appt.id}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{appt.service_type}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{appt.date} at {appt.time_slot}</div>
                    {appt.mechanic_name && <div className="text-xs text-gray-500 mt-0.5">Mechanic: {appt.mechanic_name}</div>}
                  </div>
                  <Badge className={statusColors[appt.status] || "bg-gray-700 text-gray-300"}>{appt.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <AutoAIBubble />
    </div>
  );
}