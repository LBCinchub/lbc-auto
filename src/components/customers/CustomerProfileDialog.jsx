import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Phone, Mail, MapPin, Car, Wrench, FileText, Lightbulb, Clock
} from "lucide-react";
import StatusBadge from "../shared/StatusBadge";

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

export default function CustomerProfileDialog({ customer, open, onClose }) {
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
                    <span className="text-white font-medium">{v.year} {v.make} {v.model}</span>
                    {v.license_plate && <span className="text-gray-500">· {v.license_plate}</span>}
                    {v.color && <span className="text-gray-500">· {v.color}</span>}
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
                  <div key={o.id} className="bg-gray-800/60 rounded-lg p-3 flex items-start justify-between gap-3">
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
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <StatusBadge status={o.status} />
                      {o.total_cost > 0 && (
                        <span className="text-emerald-400 text-xs font-semibold">${o.total_cost.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
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
                  <div key={inv.id} className="bg-gray-800/60 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-white font-medium">#{inv.invoice_number || inv.id?.slice(0,6)}</p>
                      <p className="text-gray-500 text-xs">{inv.vehicle_info}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-semibold">${inv.total?.toFixed(2)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
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

        </div>
      </DialogContent>
    </Dialog>
  );
}