import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Pencil, Trash2, DollarSign, Clock, History, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";

const statusFilters = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_parts", label: "Parts" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
];

export default function RepairOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => user ? base44.entities.Mechanic.filter({created_by: user.email}, "-created_date", 50) : Promise.resolve([]),
    enabled: !!user,
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["parts", user?.email],
    queryFn: () => user ? base44.entities.Part.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = orders
    .filter(o => statusFilter === "all" || o.status === statusFilter)
    .filter(o =>
      o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.vehicle_info?.toLowerCase().includes(search.toLowerCase())
    );

  const handleDelete = async (id) => {
    if (window.confirm("Delete this repair order?")) {
      await base44.entities.RepairOrder.delete(id);
      queryClient.invalidateQueries({ queryKey: ["repairOrders"] });
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["repairOrders"] });
  };

  const refreshParts = () => {
    queryClient.invalidateQueries({ queryKey: ["parts"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Repair Orders" subtitle={`${orders.length} total orders`}
        onAdd={() => { setEditingOrder(null); setDialogOpen(true); }} addLabel="New Order" />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by order #, customer, or vehicle..." />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-gray-800/50 flex-wrap h-auto">
            {statusFilters.map(s => (
              <TabsTrigger key={s.value} value={s.value}
                className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No repair orders found"
          description="Create your first repair order."
          onAction={() => { setEditingOrder(null); setDialogOpen(true); }}
          actionLabel="New Order" />
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <div key={order.id}
              className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="hidden sm:flex w-10 h-10 rounded-lg bg-sky-500/20 items-center justify-center flex-shrink-0">
                    <Wrench className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{order.order_number}</h3>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {order.customer_name} · {order.vehicle_info}
                    </p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{order.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {order.mechanic_name && (
                    <span className="text-xs text-gray-500">{order.mechanic_name}</span>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    {order.labor_hours > 0 && (
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{order.labor_hours}h
                      </span>
                    )}
                    {order.total_cost > 0 && (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />{(order.total_cost * 1.15).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {order.history && order.history.length > 0 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400"
                        onClick={() => setHistoryOrder(order)} title="View History">
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-emerald-400"
                      onClick={() => { setInvoiceOrder(order); setInvoiceDialogOpen(true); }}
                      title="Create Invoice">
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => { setEditingOrder(order); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                      onClick={() => handleDelete(order.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RepairOrderFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        order={editingOrder}
        onSaved={refresh}
        onPartAdded={refreshParts}
        customers={customers}
        vehicles={vehicles}
        mechanics={mechanics}
        parts={parts}
      />

      <InvoiceFormDialog
        open={invoiceDialogOpen}
        onClose={() => { setInvoiceDialogOpen(false); setInvoiceOrder(null); }}
        invoice={null}
        initialOrderId={invoiceOrder?.id}
        orders={orders}
        customers={customers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
      />

      {historyOrder && (
        <Dialog open={!!historyOrder} onOpenChange={() => setHistoryOrder(null)}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Repair Order History - {historyOrder.order_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyOrder.history?.map((entry, idx) => (
                <div key={idx} className="border-l-2 border-sky-500/50 pl-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-sky-400">{entry.action}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">By: {entry.user}</div>
                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div className="text-sm text-gray-300 space-y-1">
                      {Object.entries(entry.changes).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-gray-500">{key}:</span>{' '}
                          <span className="text-rose-400">{val.from || 'none'}</span> →{' '}
                          <span className="text-emerald-400">{val.to}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}