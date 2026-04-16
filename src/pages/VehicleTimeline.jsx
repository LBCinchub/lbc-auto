import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wrench, FileText, Phone, Mail, Hash, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VehicleTimeline() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => base44.entities.Vehicle.get(vehicleId),
    enabled: !!vehicleId,
  });

  const { data: repairOrders = [] } = useQuery({
    queryKey: ["repairOrders", vehicleId],
    queryFn: async () => {
      const orders = await base44.entities.RepairOrder.filter({ vehicle_id: vehicleId }, "-created_date", 100);
      return orders;
    },
    enabled: !!vehicleId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", vehicleId],
    queryFn: async () => {
      const allInvoices = await base44.entities.Invoice.list("-created_date", 500);
      return allInvoices.filter(inv => inv.vehicle_info?.includes(vehicle?.license_plate || ""));
    },
    enabled: !!vehicleId && !!vehicle,
  });

  // Combine and sort timeline events
  const timelineEvents = [
    ...repairOrders.map(order => ({
      type: "repair",
      date: new Date(order.created_date),
      order,
    })),
    ...invoices.map(invoice => ({
      type: "invoice",
      date: new Date(invoice.created_date),
      invoice,
    })),
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
          {/* Customer Name */}
          {vehicle.customer_name && (
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Owner</span>
              <span className="text-white font-medium">{vehicle.customer_name}</span>
            </div>
          )}
          {/* Phone */}
          {vehicle.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Phone</span>
              <a href={`tel:${vehicle.phone}`} className="text-sky-400 hover:text-sky-300 font-medium">{vehicle.phone}</a>
            </div>
          )}
          {/* License Plate */}
          {vehicle.license_plate && (
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Plate</span>
              <span className="text-white font-mono font-medium">{vehicle.license_plate}</span>
            </div>
          )}
          {/* VIN */}
          {vehicle.vin && (
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">VIN</span>
              <span className="text-white font-mono text-xs">{vehicle.vin}</span>
            </div>
          )}
          {/* Mileage */}
          {vehicle.mileage > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 flex-shrink-0" />
              <span className="text-gray-400 w-20 flex-shrink-0">Mileage</span>
              <span className="text-white">{vehicle.mileage?.toLocaleString()} mi</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <h2 className="text-xl font-bold text-white mb-8">Service History</h2>
        
        {timelineEvents.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No service history yet</p>
        ) : (
          <div className="space-y-4">
            {timelineEvents.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                {/* Timeline marker */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    event.type === "repair" 
                      ? "bg-blue-500/20 text-blue-400" 
                      : "bg-green-500/20 text-green-400"
                  }`}>
                    {event.type === "repair" ? (
                      <Wrench className="w-5 h-5" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  {idx < timelineEvents.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-800 my-2" />
                  )}
                </div>

                {/* Event content */}
                <div className="flex-1 pb-4">
                  <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-800 cursor-pointer hover:bg-gray-800/50 transition-colors" onClick={() => event.type === "repair" && event.order ? navigate(`/RepairOrderDetail/${event.order.id}`) : event.type === "invoice" && event.invoice ? navigate(`/InvoiceDetail/${event.invoice.id}`) : null}>
                    {event.type === "repair" && event.order ? (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white">Repair Order #{event.order.order_number}</h3>
                          <span className="text-xs text-gray-500">
                            {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mb-2">{event.order.description}</p>
                        <div className="flex gap-4 text-xs text-gray-400">
                          {event.order.mechanic_name && (
                            <span>Mechanic: {event.order.mechanic_name}</span>
                          )}
                          {event.order.status && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              event.order.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : event.order.status === "in_progress"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}>
                              {event.order.status}
                            </span>
                          )}
                        </div>
                        {event.order.total_cost > 0 && (
                          <p className="text-white font-semibold mt-2">Total: ${event.order.total_cost?.toFixed(2)}</p>
                        )}
                      </>
                    ) : event.type === "invoice" && event.invoice ? (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-white">Invoice #{event.invoice.invoice_number}</h3>
                          <span className="text-xs text-gray-500">
                            {event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400 mb-2">
                          <span>Repair Order: {event.invoice.repair_order_id}</span>
                          <span className={`px-2 py-1 rounded ${
                            event.invoice.status === "paid"
                              ? "bg-green-500/20 text-green-400"
                              : event.invoice.status === "partial"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {event.invoice.status}
                          </span>
                        </div>
                        <p className="text-white font-semibold">Total: ${event.invoice.total?.toFixed(2)}</p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}