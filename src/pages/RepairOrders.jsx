import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Pencil, Trash2, DollarSign, Clock, History, FileText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fuzzyMatch } from "@/utils/fuzzySearch";
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
  const [searchField, setSearchField] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Auto-open new order dialog if coming from customer profile
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get("customerId");
    const customerName = urlParams.get("customerName");
    if (customerId) {
      setEditingOrder({ customer_id: customerId, customer_name: customerName });
      setDialogOpen(true);
    }
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
    .filter(o => {
      if (searchField === "order_number") return fuzzyMatch(search, [o.order_number]);
      if (searchField === "customer") return fuzzyMatch(search, [o.customer_name]);
      if (searchField === "vehicle") return fuzzyMatch(search, [o.vehicle_info]);
      const vehicle = vehicles.find(v => v.id === o.vehicle_id);
      if (searchField === "vin") return fuzzyMatch(search, [vehicle?.vin, vehicle?.license_plate]);
      const customer = customers.find(c => c.id === o.customer_id);
      return fuzzyMatch(search, [o.order_number, o.customer_name, o.vehicle_info, o.description, o.mechanic_name, customer?.phone, vehicle?.vin, vehicle?.license_plate]);
    });

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

      <div className="flex gap-2 items-center">
         <Select value={searchField} onValueChange={setSearchField}>
           <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
           <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="order_number">Order #</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="vehicle">Vehicle</SelectItem>
            <SelectItem value="vin">VIN</SelectItem>
           </SelectContent>
         </Select>
         <div className="flex-1">
           <SearchBar value={search} onChange={setSearch} placeholder={
             searchField === "order_number" ? "Search by order #..." :
             searchField === "customer" ? "Search by customer..." :
             searchField === "vehicle" ? "Search by vehicle..." :
             "Search by order #, customer, or vehicle..."
           } />
         </div>
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
            <div key={order.id} onClick={() => navigate(`/RepairOrderDetail/${order.id}`)} className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-sky-500/30 transition-colors cursor-pointer">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-white font-semibold">{order.order_number}</h3>
                  <span className="text-xs text-gray-500 font-mono">{order.customer_name}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{order.vehicle_info}</p>
                {(() => {
                  const customer = customers.find(c => c.id === order.customer_id);
                  return customer?.phone ? (
                    <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium mt-0.5">
                      <Phone className="w-3 h-3" />{customer.phone}
                    </a>
                  ) : null;
                })()}
                {(() => {
                  const v = vehicles.find(veh => veh.id === order.vehicle_id);
                  return (v?.vin || v?.license_plate) ? (
                    <p className="text-xs text-gray-600 font-mono mt-0.5">
                      {v.vin && <span>VIN: {v.vin}</span>}
                      {v.vin && v.license_plate && <span className="mx-1">·</span>}
                      {v.license_plate && <span>{v.license_plate}</span>}
                    </p>
                  ) : null;
                })()}
                {order.description && <p className="text-xs text-gray-600 mt-1 truncate">{order.description}</p>}
                <p className="text-xs text-gray-600 mt-0.5">
                  Created {new Date(order.created_date).toLocaleString()}
                  {order.updated_date && order.updated_date !== order.created_date && (
                    <> · Updated {new Date(order.updated_date).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Labor</p>
                  <p className="text-sm text-gray-300">${(order.labor_cost || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Parts</p>
                  <p className="text-sm text-gray-300">${(order.parts_cost || 0).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-sky-400">${(order.total_cost || 0).toFixed(2)}</p>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {order.history && order.history.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400" title="View History"
                      onClick={() => setHistoryOrder(order)}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-emerald-400" title="Create Invoice"
                    onClick={() => { setInvoiceOrder(order); setInvoiceDialogOpen(true); }}>
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