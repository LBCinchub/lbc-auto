import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Trash2, Printer, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";
import InvoicePrintView from "../components/invoices/InvoicePrintView";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 200),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 200),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("-created_date", 200),
  });

  const filtered = invoices
    .filter(i => statusFilter === "all" || i.status === statusFilter)
    .filter(i =>
      i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.customer_name?.toLowerCase().includes(search.toLowerCase())
    );

  const handleDelete = async (id) => {
    if (window.confirm("Delete this invoice?")) {
      await base44.entities.Invoice.delete(id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const markPaid = async (inv) => {
    await base44.entities.Invoice.update(inv.id, {
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle={`${invoices.length} total invoices`}
        onAdd={() => { setEditingInvoice(null); setDialogOpen(true); }} addLabel="Create Invoice" />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice # or customer..." />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-gray-800/50">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">All</TabsTrigger>
            <TabsTrigger value="unpaid" className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Unpaid</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Paid</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Create your first invoice."
          onAction={() => { setEditingInvoice(null); setDialogOpen(true); }} actionLabel="Create Invoice" />
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <div key={inv.id}
              className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{inv.invoice_number}</h3>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {inv.customer_name} · {inv.vehicle_info}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-lg font-bold text-white">${inv.total?.toFixed(2)}</span>
                  <div className="flex gap-1">
                    {inv.status === "unpaid" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
                        onClick={() => markPaid(inv)} title="Mark as Paid">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => setPrintInvoice(inv)} title="Print">
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => { setEditingInvoice(inv); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                      onClick={() => handleDelete(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <InvoiceFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        invoice={editingInvoice}
        orders={orders}
        customers={customers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
      />

      {printInvoice && (
        <InvoicePrintView invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      )}
    </div>
  );
}