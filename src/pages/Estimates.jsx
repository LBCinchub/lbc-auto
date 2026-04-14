import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ClipboardList, Pencil, Trash2, CheckCircle2, FileText } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import EstimateFormDialog from "../components/estimates/EstimateFormDialog";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";

const STATUS_STYLES = {
  draft:    "bg-gray-700/50 text-gray-300",
  sent:     "bg-blue-500/20 text-blue-400",
  approved: "bg-green-500/20 text-green-400",
  declined: "bg-rose-500/20 text-rose-400",
  expired:  "bg-yellow-500/20 text-yellow-400",
};

export default function Estimates() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceFromEstimate, setInvoiceFromEstimate] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Auto-open new estimate dialog if coming from customer profile
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledCustomerId = urlParams.get("customerId");
  const prefilledCustomerName = urlParams.get("customerName");

  React.useEffect(() => {
    if (prefilledCustomerId) {
      setEditing({ customer_id: prefilledCustomerId, customer_name: prefilledCustomerName });
      setDialogOpen(true);
    }
  }, []);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["estimates"],
    queryFn: () => base44.entities.Estimate.list("-created_date", 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("-created_date", 200),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("-created_date", 200),
  });

  const filtered = estimates.filter(e =>
    e.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.vehicle_info?.toLowerCase().includes(search.toLowerCase()) ||
    e.estimate_number?.toLowerCase().includes(search.toLowerCase())
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
      await base44.entities.RepairOrder.create({
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_id: estimate.vehicle_id,
        vehicle_info: estimate.vehicle_info,
        description: estimate.notes || "Created from estimate #" + estimate.estimate_number,
        status: "waiting",
        labor_hours: estimate.labor_items?.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0) || 0,
        labor_cost: estimate.labor_total || 0,
        parts_used: estimate.parts_items?.map(item => ({
          name: item.name,
          part_number: item.part_number,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })) || [],
        parts_cost: estimate.parts_total || 0,
        total_cost: estimate.grand_total || 0,
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      queryClient.invalidateQueries({ queryKey: ["estimates", "repairOrders"] });
    } catch (error) {
      console.error("Error converting estimate:", error);
    }
  };

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (e) => { setEditing(e); setDialogOpen(true); };
  const openInvoiceFromEstimate = (est) => { setInvoiceFromEstimate(est); setInvoiceDialogOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estimates"
        subtitle={`${estimates.length} estimates`}
        onAdd={openNew}
        addLabel="New Estimate"
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search by customer, vehicle, or estimate #..." />

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
                  <h3 className="text-white font-semibold">{est.customer_name}</h3>
                  {est.estimate_number && (
                    <span className="text-xs text-gray-500 font-mono">#{est.estimate_number}</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[est.status] || STATUS_STYLES.draft}`}>
                    {est.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{est.vehicle_info}</p>
                {est.notes && <p className="text-xs text-gray-600 mt-1 truncate">{est.notes}</p>}
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
                  {(est.status === "approved" || est.status === "sent") && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400" title="Convert to Invoice" onClick={() => openInvoiceFromEstimate(est)}>
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  )}
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