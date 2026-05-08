import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, Phone, Mail, ChevronRight, Pencil, Trash2 } from "lucide-react";
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

const PAGE_SIZE = 20;
const AVATAR_COLORS = [
  "bg-sky-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-indigo-500"
];
function getAvatarColor(name = "") {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
}

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [activeQuickAction, setActiveQuickAction] = useState(null);
  const [quickActionData, setQuickActionData] = useState(null);
  const queryClient = useQueryClient();

  // Auto-open customer from URL param (e.g. /Customers?customerId=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get("customerId");
    if (customerId && customers.length > 0) {
      const found = customers.find(c => c.id === customerId);
      if (found) setProfileCustomer(found);
    }
  }, [customers]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => user ? base44.entities.Mechanic.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => user ? base44.entities.Invoice.filter({created_by: user.email}, "-created_date", 30000) : Promise.resolve([]),
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search, searchField]);

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
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-gray-800 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-1/3" />
                <div className="h-3 bg-gray-800/60 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers found"
          description="Add your first customer to get started."
          onAction={() => { setEditingCustomer(null); setDialogOpen(true); }}
          actionLabel="Add Customer" />
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map(customer => (
              <div key={customer.id}
                onClick={() => navigate(`/CustomerDetails?id=${customer.id}`)}
                className="flex items-center gap-4 rounded-xl border border-gray-800/60 bg-gray-900/50 px-4 py-3.5 hover:border-sky-500/30 hover:bg-gray-800/50 transition-all cursor-pointer group">
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(customer.full_name)}`}>
                  <span className="text-white font-bold text-sm">{getInitials(customer.full_name)}</span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white capitalize truncate">{customer.full_name}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                    {customer.phone && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Phone className="w-3 h-3" /> {formatPhone(customer.phone)}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail className="w-3 h-3" /> {customer.email}
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:text-white"
                    onClick={() => { setEditingCustomer(customer); setDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600 hover:text-rose-400"
                    onClick={() => handleDelete(customer.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-sky-400 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="border-gray-700 text-gray-300">Previous</Button>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="border-gray-700 text-gray-300">Next</Button>
              </div>
            </div>
          )}
        </>
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