import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, Phone, Mail, Car, Pencil, Trash2 } from "lucide-react";
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
import DateFilter, { applyDateFilter } from "../components/shared/DateFilter";

const PAGE_SIZE = 30;
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
  const [dateRange, setDateRange] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: mechanics = [] } = useQuery({
    queryKey: ["mechanics", user?.email],
    queryFn: () => user ? base44.entities.Mechanic.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => user ? base44.entities.Invoice.filter({ created_by: user.email }, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  // Build a lookup map: customerId -> vehicles[]
  const vehiclesByCustomer = vehicles.reduce((map, v) => {
    if (!map[v.customer_id]) map[v.customer_id] = [];
    map[v.customer_id].push(v);
    return map;
  }, {});

  const filtered = applyDateFilter(
    customers.filter(c => {
      const customerVehicles = vehiclesByCustomer[c.id] || [];
      const vins = customerVehicles.map(v => v.vin).join(" ");
      const plates = customerVehicles.map(v => v.license_plate).join(" ");
      const carInfo = customerVehicles.map(v => `${v.year} ${v.make} ${v.model}`).join(" ");
      if (searchField === "name") return fuzzyMatch(search, [c.full_name]);
      if (searchField === "phone") return fuzzyMatch(search, [c.phone]);
      if (searchField === "email") return fuzzyMatch(search, [c.email]);
      return fuzzyMatch(search, [c.full_name, c.phone, c.email, c.address, vins, plates, carInfo]);
    }),
    dateRange,
    r => r.created_date
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, searchField, dateRange]);

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
      <PageHeader title="Customers" subtitle={dateRange ? `${filtered.length} customers found` : `${customers.length} total customers`}
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
            "Search by name, phone, email, or vehicle..."
          } />
        </div>
      </div>

      <DateFilter onChange={setDateRange} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-52 rounded-xl bg-gray-800/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No customers found"
          description="Add your first customer to get started."
          onAction={() => { setEditingCustomer(null); setDialogOpen(true); }}
          actionLabel="Add Customer" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map(customer => {
              const cv = vehiclesByCustomer[customer.id] || [];
              return (
                <div key={customer.id}
                  onClick={() => navigate(`/CustomerDetails?id=${customer.id}`)}
                  className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3 cursor-pointer">

                  {/* Top row: avatar + name + actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getAvatarColor(customer.full_name)}`}>
                        <span className="text-white font-bold text-sm">{getInitials(customer.full_name)}</span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold capitalize leading-tight">{customer.full_name}</h3>
                        {customer.address && (
                          <p className="text-xs text-gray-500 truncate max-w-[160px]">{customer.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                        onClick={e => { e.stopPropagation(); setEditingCustomer(customer); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                        onClick={e => { e.stopPropagation(); handleDelete(customer.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1">
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`}
                        className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        {formatPhone(customer.phone)}
                      </a>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-800/60" />

                  {/* Vehicles */}
                  <div className="space-y-2">
                    {cv.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Car className="w-3.5 h-3.5" />
                        <span>No vehicle linked</span>
                      </div>
                    ) : cv.map(v => (
                      <div key={v.id}
                        className="cursor-pointer group"
                        onClick={() => navigate(`/VehicleTimeline/${v.id}`)}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                            <Car className="w-3.5 h-3.5 text-sky-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-green-400 font-medium group-hover:text-green-300 capitalize leading-tight">
                              {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                            </p>
                            {v.vin && (
                              <p className="text-xs text-gray-600 font-mono truncate">VIN: {v.vin}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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