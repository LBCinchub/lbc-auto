import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import PartFormDialog from "../components/parts/PartFormDialog";

export default function Parts() {
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ["parts"],
    queryFn: () => base44.entities.Part.list("-created_date", 200),
  });

  const lowStockParts = parts.filter(p => p.min_stock > 0 && p.quantity <= p.min_stock);

  const filtered = parts
    .filter(p => !showLowStockOnly || (p.min_stock > 0 && p.quantity <= p.min_stock))
    .filter(p => {
      if (searchField === "name") return fuzzyMatch(search, [p.name]);
      if (searchField === "part_number") return fuzzyMatch(search, [p.part_number]);
      if (searchField === "supplier") return fuzzyMatch(search, [p.supplier]);
      return fuzzyMatch(search, [p.name, p.part_number, p.supplier, p.category]);
    });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this part?")) {
      await base44.entities.Part.delete(id);
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Parts Inventory" subtitle={`${parts.length} parts in stock`}
        onAdd={() => { setEditingPart(null); setDialogOpen(true); }} addLabel="Add Part" />

      {lowStockParts.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-rose-400 font-semibold text-sm">Low Stock Alert</h3>
              <p className="text-gray-400 text-xs mt-1">
                {lowStockParts.length} part{lowStockParts.length !== 1 ? 's' : ''} {lowStockParts.length !== 1 ? 'are' : 'is'} running low on inventory
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {lowStockParts.slice(0, 5).map(p => (
                  <Badge key={p.id} className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                    {p.name}: {p.quantity}/{p.min_stock}
                  </Badge>
                ))}
                {lowStockParts.length > 5 && (
                  <Badge className="bg-gray-800 text-gray-400">
                    +{lowStockParts.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-rose-400 hover:text-rose-300"
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            >
              {showLowStockOnly ? "Show All" : "View All"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fields</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="part_number">Part #</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder={
            searchField === "name" ? "Search by part name..." :
            searchField === "part_number" ? "Search by part number..." :
            searchField === "supplier" ? "Search by supplier..." :
            "Search by name, number, or supplier..."
          } />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-gray-800/30 animate-pulse" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No parts found" description="Add parts to your inventory."
          onAction={() => { setEditingPart(null); setDialogOpen(true); }} actionLabel="Add Part" />
      ) : (
        <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/50">
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Part</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Supplier</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Cost</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Sale</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Margin</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-5 py-3">Qty</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                   const margin = p.sale_price > 0 ? ((p.sale_price - p.cost_price) / p.sale_price * 100) : 0;
                   const lowStock = p.min_stock > 0 && p.quantity <= p.min_stock;
                   return (
                     <tr key={p.id} className="border-b border-gray-800/30 hover:bg-gray-800/40 cursor-pointer transition-colors" onClick={() => { setEditingPart(p); setDialogOpen(true); }}>
                       <td className="px-5 py-3">
                         <div>
                           <span className="text-white text-sm font-medium">{p.name}</span>
                           {p.part_number && (
                             <span className="text-xs text-gray-600 ml-2">#{p.part_number}</span>
                           )}
                         </div>
                         {p.category && <p className="text-xs text-gray-500">{p.category}</p>}
                       </td>
                       <td className="px-5 py-3 text-sm text-gray-400">{p.supplier || "—"}</td>
                       <td className="px-5 py-3 text-sm text-gray-400 text-right">${p.cost_price?.toFixed(2)}</td>
                       <td className="px-5 py-3 text-sm text-white text-right font-medium">${p.sale_price?.toFixed(2)}</td>
                       <td className="px-5 py-3 text-sm text-right">
                         <span className={margin > 30 ? "text-emerald-400" : margin > 0 ? "text-amber-400" : "text-rose-400"}>
                           {margin.toFixed(0)}%
                         </span>
                       </td>
                       <td className="px-5 py-3 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <span className={`text-sm font-medium ${lowStock ? "text-rose-400" : "text-white"}`}>
                             {p.quantity}
                           </span>
                           {lowStock && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                         </div>
                       </td>
                       <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-end gap-1">
                           <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-white"
                             onClick={() => { setEditingPart(p); setDialogOpen(true); }}>
                             <Pencil className="w-3 h-3" />
                           </Button>
                           <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-rose-400"
                             onClick={() => handleDelete(p.id)}>
                             <Trash2 className="w-3 h-3" />
                           </Button>
                         </div>
                       </td>
                     </tr>
                   );
                 })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PartFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        part={editingPart}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["parts"] })}
      />
    </div>
  );
}