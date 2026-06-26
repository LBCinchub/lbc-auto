import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation} from 'react-router-dom';
import { Users, Phone, Mail, Car, Pencil, Trash2, DollarSign } from "lucide-react";
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
  const _location = useLocation();
  const _urlQ = new URLSearchParams(_location.search).get("q") || "";
  const [search, setSearch] = useState(_urlQ);
  // Sync search if URL param changes (e.g. navigating from GlobalSearch)
  React.useEffect(() => {
    const q = new URLSearchParams(_location.search).get("q") || "";
    if (q) setSearch(q);
  }, [_location.search]);
  const [searchField, setSearchField] = useState(() => new URLSearchParams(window.location.search).get("sf") || "all");
  const [page, setPage] = useState(() => parseInt(new URLSearchParams(window.location.search).get("pg") || "1", 10));
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
  const vehiclesByCustomer = useMemo(() => vehicles.reduce((map, v) => {
    if (!map[v.customer_id]) map[v.customer_id] = [];
    map[v.customer_id].push(v);
    return map;
  }, {}), [vehicles]);

  // Build invoice stats per customer
  const invoiceStatsByCustomer = useMemo(() => {
    const map = {};
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      if (!map[inv.customer_id]) map[inv.customer_id] = { lastPaidDate: null, outstandingBalance: 0 };
      const entry = map[inv.customer_id];
      if (inv.status === "paid" && inv.paid_date) {
        const d = new Date(inv.paid_date);
        if (!entry.lastPaidDate || d > new Date(entry.lastPaidDate)) {
          entry.lastPaidDate = inv.paid_date;
        }
      }
      if (inv.status !== "paid") {
        entry.outstandingBalance += parseFloat(inv.balance_due) || 0;
      }
    }
    return map;
  }, [invoices]);

  function getActivityStatus(customerId) {
    const stats = invoiceStatsByCustomer[customerId];
    if (!stats?.lastPaidDate) return "inactive";
    const days = Math.floor((new Date() - new Date(stats.lastPaidDate)) / (1000 * 60 * 60 * 24));
    if (days <= 90) return "active";
    if (days <= 180) return "idle";
    return "inactive";
  }

  const statusDot = { active: "bg-emerald-400", idle: "bg-amber-400", inactive: "bg-rose-500" };
  const statusLabel = { active: "Active", idle: "Idle", inactive: "Inactive" };

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


  // URL persistence — keeps filters in sync so Back/Forward restores layout
  const _location = useLocation();
  const _navigate = useNavigate();
  const _pushParams = React.useCallback((updates) => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'all' || v === 1) p.delete(k);
      else p.set(k, String(v));
    });
    const qs = p.toString();
    _navigate({ search: qs ? '?' + qs : '' }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    const _p = new URLSearchParams(_location.search);
    const _q = _p.get('q') || '';
    setSearch(prev => prev !== _q ? _q : prev);
    const _sf = _p.get('sf') || 'all';
    setSearchField(prev => prev !== _sf ? _sf : prev);
    const _pg = parseInt(_p.get('pg') || '1', 10);
    setPage(prev => prev !== _pg ? _pg : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_location.search]);
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle={dateRange ? `${filtered.length} customers found` : `${customers.length} total customers`}
        onAdd={() => { setEditingCustomer(null); setDialogOpen(true); }} addLabel="Add Customer" />

      <div className="flex gap-2 items-center">
        <Select value={searchField} onValueChange={(v) => { setSearchField(v); _pushParams({ sf: v }); }}>
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
          <SearchBar value={search} onChange={(v) => { setSearch(v); _pushParams({ q: v }); }} placeholder={
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
              const stats = invoiceStatsByCustomer[customer.id];
              const activity = getActivityStatus(customer.id);
              const outstanding = stats?.outstandingBalance || 0;
              const lastService = stats?.lastPaidDate ? new Date(stats.lastPaidDate).toLocaleDateString("en-CA") : null;

              return (
                <div key={customer.id}
                  onClick={() => navigate(`/CustomerDetails?id=${customer.id}`)}
                  className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3 cursor-pointer">

                  {/* Top row: avatar + name + status + actions */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getAvatarColor(customer.full_name)}`}>
                        <span className="text-white font-bold text-sm">{getInitials(customer.full_name)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold capitalize leading-tight">{customer.full_name}</h3>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[activity]}`} title={statusLabel[activity]} />
                        </div>
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

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span className="flex items-center gap-1 text-gray-400">
                      <Car className="w-3 h-3" />
                      {cv.length} vehicle{cv.length !== 1 ? "s" : ""}
                    </span>
                    {lastService && (
                      <span className="text-gray-500">Last: {lastService}</span>
                    )}
                    {outstanding > 0 && (
                      <span className="flex items-center gap-1 text-rose-400 font-medium">
                        <DollarSign className="w-3 h-3" />
                        {outstanding.toFixed(2)} due
                      </span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-800/60" />

                  {/* Vehicles (compact) */}
                  <div className="space-y-1">
                    {cv.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Car className="w-3.5 h-3.5" />
                        <span>No vehicle linked</span>
                      </div>
                    ) : cv.slice(0, 2).map(v => (
                      <div key={v.id}
                        className="cursor-pointer group"
                        onClick={e => { e.stopPropagation(); navigate(`/VehicleTimeline/${v.id}`); }}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                            <Car className="w-3 h-3 text-sky-400" />
                          </div>
                          <p className="text-sm text-green-400 font-medium group-hover:text-green-300 capitalize leading-tight">
                            {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                            {v.license_plate ? ` — ${v.license_plate}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                    {cv.length > 2 && (
                      <p className="text-xs text-gray-600 pl-8">+{cv.length - 2} more</p>
                    )}
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