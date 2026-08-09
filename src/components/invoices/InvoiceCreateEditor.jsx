import React, { useEffect, useState } from "react";
import { Search, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useFinancialWorkflow from "@/components/financial-workflow/useFinancialWorkflow";
import InvoiceDetailsFields from "@/components/invoices/InvoiceDetailsFields";
import InvoiceLineItemsTable from "@/components/invoices/InvoiceLineItemsTable";
import InvoiceTotalsSection from "@/components/invoices/InvoiceTotalsSection";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

/**
 * Unified Invoice CREATE editor for the blank-new flow (no existing source).
 *
 * Mirrors the InvoiceDetail layout exactly by reusing the same shared
 * sub-components (InvoiceDetailsFields + InvoiceLineItemsTable +
 * InvoiceTotalsSection). Customer/vehicle selection lives in the top-right
 * header via a searchable customer dropdown — once a vehicle is chosen, the
 * financial workflow loads the draft through the same backend
 * (financialDocumentAction) used for every other invoice surface, so all
 * payment/financial logic is unchanged.
 */
export default function InvoiceCreateEditor({ prefill, customers = [], onClose, onSaved }) {
  const { toast } = useToast();
  const [source, setSource] = useState(() => (prefill?.vehicle_id ? { type: "vehicle", id: prefill.vehicle_id } : null));
  const flow = useFinancialWorkflow({ open: true, source, onSaved });

  const [custSearch, setCustSearch] = useState(prefill?.customer_name || "");
  const [custDropdown, setCustDropdown] = useState([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState(prefill?.customer_name || "");
  const [selectedVehicle, setSelectedVehicle] = useState(prefill?.vehicle_id || "");

  // Prefill: load the customer's vehicles so the header vehicle dropdown is populated
  useEffect(() => {
    let mounted = true;
    if (prefill?.customer_id) {
      base44.entities.Vehicle.filter({ customer_id: prefill.customer_id })
        .then((vehs) => { if (mounted) setCustomerVehicles(vehs); })
        .catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  const searchCustomers = (q) => {
    if (!q.trim()) { setCustDropdown([]); setShowCustDropdown(false); return; }
    const lower = q.toLowerCase();
    const results = (customers || [])
      .filter(Boolean)
      .filter((c) => (c.full_name || "").toLowerCase().includes(lower) || (c.phone || "").includes(q))
      .slice(0, 8);
    setCustDropdown(results);
    setShowCustDropdown(true);
  };

  const selectCustomer = (c) => {
    setSelectedCustomerName(c.full_name);
    setCustSearch(c.full_name);
    setShowCustDropdown(false);
    setCustDropdown([]);
    setSelectedVehicle("");
    setSource(null);
    setCustomerVehicles([]);
    base44.entities.Vehicle.filter({ customer_id: c.id }).then(setCustomerVehicles).catch(() => {});
  };

  const clearCustomer = () => {
    setSelectedCustomerName("");
    setCustSearch("");
    setSelectedVehicle("");
    setSource(null);
    setCustomerVehicles([]);
  };

  const chooseVehicle = (vid) => {
    setSelectedVehicle(vid);
    setSource({ type: "vehicle", id: vid });
  };

  const onCustSearchChange = (val) => {
    setCustSearch(val);
    if (selectedCustomerName) clearCustomer();
    searchCustomers(val);
  };

  const save = async () => {
    if (!source) { toast({ title: "Please select a customer and vehicle", variant: "destructive" }); return; }
    const saved = await flow.act("create");
    if (saved) onClose();
  };

  const customerSelected = !!selectedCustomerName || !!source;

  return (
    <>
      {/* Header — "New Invoice" + customer/vehicle selection in top-right */}
      <div className="border-b border-gray-800 px-5 py-4 md:px-6">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Invoice</p>
            <h2 className="mt-1 text-xl font-bold text-white">New Invoice</h2>
          </div>
          <div className="text-right text-sm min-w-[240px]">
            {customerSelected ? (
              <>
                <div className="flex items-center justify-end gap-2">
                  <p className="font-medium text-white">{selectedCustomerName}</p>
                  <button type="button" onClick={clearCustomer} className="text-xs text-gray-500 underline hover:text-gray-300">Change</button>
                </div>
                <Select value={selectedVehicle || ""} onValueChange={chooseVehicle}>
                  <SelectTrigger className="mt-1 h-8 w-full bg-gray-950 border-gray-700 text-white">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    {customerVehicles.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No vehicles on file</div>}
                    {customerVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {`${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim()}{v.license_plate ? ` · ${v.license_plate}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={custSearch}
                  onChange={(e) => onCustSearchChange(e.target.value)}
                  onFocus={() => { if (custSearch) searchCustomers(custSearch); }}
                  onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
                  placeholder="Search customer by name or phone..."
                  className="bg-gray-950 border-gray-700 text-white pl-8"
                />
                {showCustDropdown && custDropdown.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl text-left">
                    {custDropdown.map((c) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)} className="w-full px-3 py-2 hover:bg-sky-500/20 text-sm text-white flex justify-between">
                        <span>{c.full_name}</span>
                        <span className="text-gray-400 text-xs">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body — identical shared sub-components as InvoiceDetail */}
      <div className="max-h-[60vh] overflow-y-auto px-5 py-5 md:px-6">
        {flow.loading ? (
          <div className="py-20 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Loading…</div>
        ) : source && flow.draft ? (
          <>
            <InvoiceDetailsFields draft={flow.draft} onChange={flow.setDraft} />
            <InvoiceLineItemsTable lines={flow.draft.line_items || []} onChange={(line_items) => flow.setDraft({ ...flow.draft, line_items })} />
            <InvoiceTotalsSection draft={flow.draft} totals={flow.totals} onChange={flow.setDraft} />
            {flow.error && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{flow.error}</p>}
          </>
        ) : flow.error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{flow.error}</p>
        ) : (
          <div className="py-20 text-center text-gray-500">Select a customer and vehicle to begin.</div>
        )}
      </div>

      {/* Actions — only Cancel + Save for a new invoice */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-5 py-4 md:px-6">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onClose?.()}>Cancel</Button>
          <Button onClick={save} disabled={flow.saving || !source || !flow.draft} className="bg-sky-500 hover:bg-sky-600">
            {flow.saving ? <Loader2 className="animate-spin" /> : <Save />}{flow.saving ? "Saving…" : "Save Invoice"}
          </Button>
        </div>
      </div>
    </>
  );
}