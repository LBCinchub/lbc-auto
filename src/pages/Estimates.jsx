import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ClipboardList, Pencil, Trash2, CheckCircle2, FileText, Phone, Mail, Hash, Sheet, Send, Loader2 } from "lucide-react";
import { useEmailSend } from "@/hooks/useEmailSend";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import { formatPhone } from "@/utils/formatPhone";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import EstimateFormDialog from "../components/estimates/EstimateFormDialog";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";
import DateFilter, { applyDateFilter } from "../components/shared/DateFilter";

const STATUS_STYLES = {
  draft:    "bg-gray-700/50 text-gray-300",
  sent:     "bg-blue-500/20 text-blue-400",
  approved: "bg-green-500/20 text-green-400",
  declined: "bg-rose-500/20 text-rose-400",
  expired:  "bg-yellow-500/20 text-yellow-400",
};

export default function Estimates() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceFromEstimate, setInvoiceFromEstimate] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Auto-open new estimate dialog if coming from customer profile
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledCustomerId = urlParams.get("customerId");
  const prefilledCustomerName = urlParams.get("customerName");

  React.useEffect(() => {
    if (prefilledCustomerId) {
      const prefilledVehicleId = urlParams.get("vehicleId");
      const prefilledVehicleInfo = urlParams.get("vehicleInfo");
      setEditing({ customer_id: prefilledCustomerId, customer_name: prefilledCustomerName, vehicle_id: prefilledVehicleId || "", vehicle_info: prefilledVehicleInfo || "" });
      setDialogOpen(true);
    }
  }, []);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts", user?.email],
    queryFn: () => user ? base44.entities.Part.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = applyDateFilter(
    estimates.filter(e => {
      if (searchField === "customer") return fuzzyMatch(search, [e.customer_name]);
      if (searchField === "vehicle") return fuzzyMatch(search, [e.vehicle_info]);
      if (searchField === "estimate_number") return fuzzyMatch(search, [e.estimate_number]);
      const customer = customers.find(c => c.id === e.customer_id);
      return fuzzyMatch(search, [e.estimate_number, e.customer_name, e.vehicle_info, e.notes, customer?.phone]);
    }),
    dateRange,
    r => r.created_date
  );

  const handleDelete = async (id) => {
    if (window.confirm("Delete this estimate?")) {
      await base44.entities.Estimate.delete(id);
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    }
  };

  const handleConvertToRepairOrder = async (estimate) => {
    if (!window.confirm("Convert this estimate to a repair order?")) return;
    try {
      const description = estimate.notes || estimate.labor_items?.map(i => i.description).filter(Boolean).join(", ") || "Created from estimate #" + estimate.estimate_number;
      await base44.entities.RepairOrder.create({
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_id: estimate.vehicle_id,
        vehicle_info: estimate.vehicle_info,
        description: description,
        status: "waiting",
        labor_hours: estimate.labor_items?.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0) || 0,
        labor_cost: estimate.labor_total || 0,
        labor_items: estimate.labor_items || [],
        parts_used: estimate.parts_items?.map(item => ({
          name: item.name,
          part_number: item.part_number,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })) || [],
        parts_cost: estimate.parts_total || 0,
        total_cost: estimate.grand_total || 0,
        notes: estimate.notes || "",
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      queryClient.invalidateQueries({ queryKey: ["estimates", "repairOrders"] });
    } catch (error) {
      console.error("Error converting estimate:", error);
    }
  };

  const exportCSV = () => {
    const headers = ["Estimate #", "Date", "Customer", "Vehicle", "Status", "Labor", "Parts", "Tax", "Grand Total", "Valid Until", "Notes"];
    const rows = filtered.map(est => [
      est.estimate_number || "",
      new Date(est.created_date).toLocaleDateString(),
      est.customer_name || "",
      est.vehicle_info || "",
      est.status || "",
      (est.labor_total || 0).toFixed(2),
      (est.parts_total || 0).toFixed(2),
      (est.tax_amount || 0).toFixed(2),
      (est.grand_total || 0).toFixed(2),
      est.valid_until || "",
      est.notes || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estimates-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { sending: sendingEmail, sendEmail } = useEmailSend();

  const sendEstimateEmail = (e, est) => {
    e.stopPropagation();
    const customer = customers.find(c => c.id === est.customer_id);
    const to = customer?.email;
    const subject = `Your Estimate #${est.estimate_number}`;
    const laborLines = (est.labor_items || []).filter(l => l.description).map(l => `  - ${l.description}: ${l.hours}h @ $${parseFloat(l.rate||0).toFixed(2)}/hr = $${((parseFloat(l.hours)||0)*(parseFloat(l.rate)||0)).toFixed(2)}`).join("\n");
    const partsLines = (est.parts_items || []).filter(p => p.name).map(p => `  - ${p.name}${p.part_number ? ` (${p.part_number})` : ""} x${p.quantity} @ $${parseFloat(p.unit_price||0).toFixed(2)} = $${((parseFloat(p.quantity)||0)*(parseFloat(p.unit_price)||0)).toFixed(2)}`).join("\n");
    const body = `Hello ${est.customer_name},\n\nPlease find your estimate details below.\n\nEstimate #: ${est.estimate_number}\nVehicle: ${est.vehicle_info}\nDate: ${new Date(est.created_date).toLocaleDateString()}\nStatus: ${est.status}\n${est.valid_until ? `Valid Until: ${est.valid_until}\n` : ""}\n--- LABOR ---\n${laborLines || "  None"}\n\n--- PARTS ---\n${partsLines || "  None"}\n\n--- SUMMARY ---\nLabor Total:  $${(est.labor_total||0).toFixed(2)}\nParts Total:  $${(est.parts_total||0).toFixed(2)}\nTax:          $${(est.tax_amount||0).toFixed(2)}\nGrand Total:  $${(est.grand_total||0).toFixed(2)}\n${est.notes ? `\nNotes: ${est.notes}` : ""}\n\nThank you for your business!\nPlease contact us if you have any questions.`;
    sendEmail(est.id, to, subject, body);
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e) => { setEditing(e); setDialogOpen(true); };
  const openInvoiceFromEstimate = (est) => { setInvoiceFromEstimate(est); setInvoiceDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Estimates"
          subtitle={dateRange ? `${filtered.length} estimates found` : `${estimates.length} estimates`}
          onAdd={openNew}
          addLabel="New Estimate"
        />
        <Button variant="outline" size="sm" onClick={exportCSV} className="border-gray-700 text-gray-300 hover:text-white gap-2 flex-shrink-0">
          <Sheet className="w-4 h-4" /> Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vehicle">Vehicle</SelectItem>
            <SelectItem value="estimate_number">Estimate #</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder={
            searchField === "customer" ? "Search by customer..." :
            searchField === "vehicle" ? "Search by vehicle..." :
            searchField === "estimate_number" ? "Search by estimate #..." :
            "Search by customer, vehicle, or estimate #..."
          } />
        </div>
      </div>

      <DateFilter onChange={setDateRange} />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No estimates yet"
          description="Create your first service estimate for a customer."
          onAction={openNew}
          actionLabel="New Estimate"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(est => (
            <div key={est.id} onClick={() => navigate(`/EstimateDetail/${est.id}`)} className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-sky-500/30 transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-blue-400 font-semibold capitalize">{est.customer_name}</h3>
                  {est.estimate_number && (
                    <span className="text-xs text-gray-500 font-mono">#{est.estimate_number}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[est.status] || STATUS_STYLES.draft}`}>
                    {est.status}
                  </span>
                </div>
                <p className="text-sm text-green-400 mt-0.5 capitalize">{est.vehicle_info}</p>
                {(() => {
                  const customer = customers.find(c => c.id === est.customer_id);
                  const vehicle = vehicles.find(v => v.id === est.vehicle_id);
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {customer?.phone && (
                        <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium">
                          <Phone className="w-3 h-3" />{formatPhone(customer.phone)}
                        </a>
                      )}
                      {customer?.email && (
                        <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium">
                          <Mail className="w-3 h-3" />{customer.email}
                        </a>
                      )}
                      {vehicle?.license_plate && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
                          <Hash className="w-3 h-3" />{vehicle.license_plate}
                        </span>
                      )}
                      {vehicle?.vin && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-mono">
                          VIN: {vehicle.vin}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {est.notes && <p className="text-xs text-gray-600 mt-1 truncate">{est.notes}</p>}
                <p className="text-xs text-gray-600 mt-0.5">
                  Created {new Date(est.created_date).toLocaleString()}
                  {est.updated_date && est.updated_date !== est.created_date && (
                    <> · Updated {new Date(est.updated_date).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Labor</p>
                  <p className="text-sm text-gray-300">${(est.labor_total || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Parts</p>
                  <p className="text-sm text-gray-300">${(est.parts_total || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-sky-400">${(est.grand_total || 0).toFixed(2)}</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400" title="Send to Customer" onClick={e => sendEstimateEmail(e, est)} disabled={sendingEmail === est.id}>
                    {sendingEmail === est.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400" title="Convert to Invoice" onClick={() => openInvoiceFromEstimate(est)}>
                    <FileText className="w-3.5 h-3.5" />
                  </Button>
                  {est.status === "approved" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-green-400" title="Convert to Repair Order" onClick={() => handleConvertToRepairOrder(est)}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white" onClick={() => openEdit(est)}>
                     <Pencil className="w-3.5 h-3.5" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400" onClick={() => handleDelete(est.id)}>
                     <Trash2 className="w-3.5 h-3.5" />
                   </Button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EstimateFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        estimate={editing}
        customers={customers}
        vehicles={vehicles}
        parts={parts}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["estimates"] })}
      />

      <InvoiceFormDialog
        open={invoiceDialogOpen}
        onClose={() => { setInvoiceDialogOpen(false); setInvoiceFromEstimate(null); }}
        invoice={null}
        orders={[]}
        customers={customers}
        sourceEstimate={invoiceFromEstimate}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["estimates"] });
          queryClient.invalidateQueries({ queryKey: ["invoices"] });
        }}
      />
    </div>
  );
}