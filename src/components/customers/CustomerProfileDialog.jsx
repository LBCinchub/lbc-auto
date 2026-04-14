import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Phone, Mail, MapPin, Car, Wrench, FileText, Lightbulb, Clock, Plus, Pencil, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "../shared/StatusBadge";
import VehicleFormDialog from "@/components/vehicles/VehicleFormDialog";

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

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("-created_date", 200),
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

          {/* Contact Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Phone className="w-4 h-4 text-sky-400 flex-shrink-0" /> {customer.phone}
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

          {/* Vehicles */}
          <Section icon={Car} title="Vehicles">
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

          {/* Repair History */}
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

          {/* Invoices */}
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

          {/* Recommendations */}
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

          {/* Quick Actions */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">Quick Actions</p>
            <div className="grid grid-cols-3 gap-3">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/Estimates?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <FileText className="w-4 h-4" />
                <span className="text-xs">New Estimate</span>
              </Button>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/RepairOrders?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <Wrench className="w-4 h-4" />
                <span className="text-xs">Repair Order</span>
              </Button>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white flex flex-col h-auto py-3 gap-1"
                onClick={() => { onClose(); navigate(`/Invoices?customerId=${customer.id}&customerName=${encodeURIComponent(customer.full_name)}`); }}>
                <FileText className="w-4 h-4" />
                <span className="text-xs">New Invoice</span>
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}