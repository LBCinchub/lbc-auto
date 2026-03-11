import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Pencil, Trash2, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";

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
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["repairOrders"],
    queryFn: () => base44.entities.RepairOrder.list("-created_date", 200),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("-created_date", 200),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list("-created_date", 200),
  });
  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics"],
    queryFn: () => base44.entities.Mechanic.list("-created_date", 50),
  });
  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list("-created_date", 200),
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
                        <DollarSign className="w-3 h-3" />{order.total_cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
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
        customers={customers}
        vehicles={vehicles}
        mechanics={mechanics}
        parts={parts}
      />
    </div>
  );
}