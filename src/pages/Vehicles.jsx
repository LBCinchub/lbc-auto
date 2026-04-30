import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Pencil, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import VehicleFormDialog from "../components/vehicles/VehicleFormDialog";

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = vehicles.filter(v => {
    if (searchField === "make_model") return fuzzyMatch(search, [v.make, v.model, String(v.year || "")]);
    if (searchField === "customer") return fuzzyMatch(search, [v.customer_name]);
    if (searchField === "plate") return fuzzyMatch(search, [v.license_plate]);
    if (searchField === "vin") return fuzzyMatch(search, [v.vin]);
    return fuzzyMatch(search, [v.customer_name, v.make, v.model, String(v.year || ""), v.license_plate, v.vin, v.color, v.engine_type]);
  });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this vehicle?")) {
      await base44.entities.Vehicle.delete(id);
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles" subtitle={`${vehicles.length} vehicles registered`}
        onAdd={() => { setEditingVehicle(null); setDialogOpen(true); }} addLabel="Add Vehicle" />

      <div className="flex gap-2 items-center">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="make_model">Make/Model</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="plate">License Plate</SelectItem>
            <SelectItem value="vin">VIN</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder={
            searchField === "make_model" ? "Search by make or model..." :
            searchField === "customer" ? "Search by customer..." :
            searchField === "plate" ? "Search by license plate..." :
            searchField === "vin" ? "Search by VIN..." :
            "Search by make, model, VIN, plate, or customer..."
          } />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Car} title="No vehicles found"
          description="Add your first vehicle to get started."
          onAction={() => { setEditingVehicle(null); setDialogOpen(true); }}
          actionLabel="Add Vehicle" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <Car className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{v.year} {v.make} {v.model}</h3>
                    {v.customer_name && (
                      <p className="text-xs text-sky-400 font-medium">👤 {v.customer_name}</p>
                    )}
                    {(() => { const c = customers.find(c => c.id === v.customer_id); return c?.phone ? <p className="text-xs text-gray-400">{c.phone}</p> : null; })()}
                  </div>
                </div>
                <div className="flex gap-1">
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400"
                     onClick={() => navigate(`/VehicleTimeline/${v.id}`)}>
                     <Clock className="w-3.5 h-3.5" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                     onClick={() => { setEditingVehicle(v); setDialogOpen(true); }}>
                     <Pencil className="w-3.5 h-3.5" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                     onClick={() => handleDelete(v.id)}>
                     <Trash2 className="w-3.5 h-3.5" />
                   </Button>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {v.license_plate && (
                  <div className="text-gray-400"><span className="text-gray-600">Plate:</span> {v.license_plate}</div>
                )}
                {v.color && (
                  <div className="text-gray-400"><span className="text-gray-600">Color:</span> {v.color}</div>
                )}
                {v.mileage > 0 && (
                  <div className="text-gray-400"><span className="text-gray-600">Miles:</span> {v.mileage?.toLocaleString()}</div>
                )}
                {v.engine_type && (
                  <div className="text-gray-400"><span className="text-gray-600">Engine:</span> {v.engine_type}</div>
                )}
              </div>
              {v.vin && (
                <p className="mt-2 text-xs text-gray-600 font-mono">VIN: {v.vin}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <VehicleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        vehicle={editingVehicle}
        customers={customers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["vehicles"] })}
      />
    </div>
  );
}