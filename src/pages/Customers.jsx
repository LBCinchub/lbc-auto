import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Phone, Mail, MapPin, Pencil, Trash2, Car } from "lucide-react";
import CustomerProfileDialog from "../components/customers/CustomerProfileDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import { formatPhone } from "@/utils/formatPhone";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import CustomerFormDialog from "../components/customers/CustomerFormDialog";
import AppointmentFormDialog from "../components/appointments/AppointmentFormDialog";
import EstimateFormDialog from "../components/estimates/EstimateFormDialog";
import RepairOrderFormDialog from "../components/orders/RepairOrderFormDialog";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [quickActionData, setQuickActionData] = useState(null);
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => user ? base44.entities.Mechanic.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => user ? base44.entities.Invoice.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = customers.filter(c => {
    const customerVehicles = vehicles.filter(v => v.customer_id === c.id);
    const vins = customerVehicles.map(v => v.vin).join(" ");
    const plates = customerVehicles.map(v => v.license_plate).join(" ");
    const carInfo = customerVehicles.map(v => `${v.year} ${v.make} ${v.model}`).join(" ");
    if (searchField === "name") return fuzzyMatch(search, [c.full_name]);
    if (searchField === "phone") return fuzzyMatch(search, [c.phone]);
    if (searchField === "email") return fuzzyMatch(search, [c.email]);
    return fuzzyMatch(search, [c.full_name, c.phone, c.email, c.address, vins, plates, carInfo]);
  });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this customer?")) {
      await base44.entities.Customer.delete(id);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  };

  const handleQuickAction = (page, data) => {
    setActiveQuickAction(page);
    setQuickActionData(data);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle={`${customers.length} total customers`}
        onAdd={() => { setEditingCustomer(null); setDialogOpen(true); }} addLabel="Add Customer" />

      <div className="flex gap-2 items-center">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder={
            searchField === "name" ? "Search by name..." :
            searchField === "phone" ? "Search by phone..." :
            searchField === "email" ? "Search by email..." :
            "Search by name, phone, or email..."
          } />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers found"
          description="Add your first customer to get started."
          onAction={() => { setEditingCustomer(null); setDialogOpen(true); }}
          actionLabel="Add Customer" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {filtered.map(customer => (
             <button key={customer.id} onClick={() => setProfileCustomer(customer)}
               className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 hover:bg-gray-800/50 transition-all text-left">
               <div className="flex items-start justify-between mb-3">
                 <div className="flex items-center gap-3 flex-1 min-w-0">
                   <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                     <span className="text-sky-400 font-semibold text-sm">
                       {customer.full_name?.charAt(0)?.toUpperCase()}
                     </span>
                   </div>
                   <h3 className="text-white font-semibold truncate">{customer.full_name}</h3>
                 </div>
                 <div className="flex gap-1 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                    onClick={() => { setEditingCustomer(customer); setDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                    onClick={() => handleDelete(customer.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                 </div>
              </div>
              <div className="space-y-1.5">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-sky-400 transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {formatPhone(customer.phone)}
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-sky-400 transition-colors">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </a>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-3.5 h-3.5" /> {customer.address}
                  </div>
                )}
                </div>
                {/* Vehicles */}
                {(() => {
                  const cVehicles = vehicles.filter(v => v.customer_id === customer.id);
                  if (cVehicles.length === 0) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-800/60 space-y-1.5">
                      {cVehicles.map(v => (
                        <div key={v.id} className="flex items-center gap-2">
                          <Car className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                          <div className="text-xs text-gray-400 min-w-0">
                            <span className="text-gray-300">{v.year} {v.make} {v.model}</span>
                            {v.license_plate && <span className="ml-2 text-gray-500 font-mono">{v.license_plate}</span>}
                            {v.vin && <span className="ml-2 text-gray-600 font-mono truncate">VIN: {v.vin}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                </button>
                ))}
                </div>
      )}

      <CustomerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={editingCustomer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
        onQuickAction={handleQuickAction}
      />
      <CustomerProfileDialog
        open={!!profileCustomer}
        customer={profileCustomer}
        customers={customers}
        onClose={() => setProfileCustomer(null)}
      />
      <AppointmentFormDialog
        open={activeQuickAction === "Appointments"}
        onClose={() => setActiveQuickAction(null)}
        appointment={quickActionData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })}
        customers={customers}
        vehicles={vehicles}
        mechanics={mechanics}
      />
      <EstimateFormDialog
        open={activeQuickAction === "Estimates"}
        onClose={() => setActiveQuickAction(null)}
        estimate={quickActionData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["estimates"] })}
        customers={customers}
        vehicles={vehicles}
      />
      <RepairOrderFormDialog
        open={activeQuickAction === "RepairOrders"}
        onClose={() => setActiveQuickAction(null)}
        order={quickActionData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
        customers={customers}
        vehicles={vehicles}
        mechanics={mechanics}
        parts={[]}
      />
      <InvoiceFormDialog
        open={activeQuickAction === "Invoices"}
        onClose={() => setActiveQuickAction(null)}
        invoice={quickActionData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
        orders={orders}
        customers={customers}
      />
    </div>
  );
}