import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Phone, Mail, MapPin, Pencil, Trash2, Eye } from "lucide-react";
import CustomerProfileDialog from "../components/customers/CustomerProfileDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import CustomerFormDialog from "../components/customers/CustomerFormDialog";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [profileCustomer, setProfileCustomer] = useState(null);
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

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (searchField === "name") return c.full_name?.toLowerCase().includes(s);
    if (searchField === "phone") return c.phone?.includes(search);
    if (searchField === "email") return c.email?.toLowerCase().includes(s);
    // "all"
    return c.full_name?.toLowerCase().includes(s) || c.phone?.includes(search) || c.email?.toLowerCase().includes(s);
  });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this customer?")) {
      await base44.entities.Customer.delete(id);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400"
                    onClick={() => setProfileCustomer(customer)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
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
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Phone className="w-3.5 h-3.5" /> {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="w-3.5 h-3.5" /> {customer.address}
                  </div>
                )}
                </div>
                </button>
                ))}
                </div>
      )}

      <CustomerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        customer={editingCustomer}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
      />
      <CustomerProfileDialog
        open={!!profileCustomer}
        customer={profileCustomer}
        customers={customers}
        onClose={() => setProfileCustomer(null)}
      />
    </div>
  );
}