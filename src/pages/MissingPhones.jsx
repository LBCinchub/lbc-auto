import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Search, CheckCircle2 } from "lucide-react";

export default function MissingPhones() {
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [phoneInputs, setPhoneInputs] = useState({});
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState({});
  const sessionAdded = Object.keys(saved).length;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [allCustomers, allVehicles] = await Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Vehicle.list(),
    ]);
    const missing = allCustomers.filter(c => !c.phone || c.phone.trim() === "");
    setCustomers(missing);
    setVehicles(allVehicles);
    setLoading(false);
  }

  function getVehicle(customerId) {
    const v = vehicles.find(v => v.customer_id === customerId);
    if (!v) return "—";
    return `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "—";
  }

  async function handleSave(customer) {
    const phone = (phoneInputs[customer.id] || "").trim();
    if (phone.length < 7) return;
    setSaving(s => ({ ...s, [customer.id]: true }));
    await base44.entities.Customer.update(customer.id, { phone });
    setSaved(s => ({ ...s, [customer.id]: phone }));
    setSaving(s => ({ ...s, [customer.id]: false }));
    toast.success(`Phone saved for ${customer.full_name}`);
  }

  const filtered = customers.filter(c => {
    if (saved[c.id]) return false; // remove saved rows
    const q = search.toLowerCase();
    if (!q) return true;
    const vehicle = getVehicle(c.id).toLowerCase();
    return c.full_name?.toLowerCase().includes(q) || vehicle.includes(q);
  });

  const total = customers.length;
  const remaining = total - sessionAdded;
  const pct = total > 0 ? Math.round((sessionAdded / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Phone className="w-6 h-6 text-sky-400" />
          Missing Phones
        </h1>
        <p className="text-gray-400 text-sm mt-1">Customers without a phone number on file</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Missing", value: total, color: "text-red-400" },
          { label: "Added This Session", value: sessionAdded, color: "text-green-400" },
          { label: "Remaining", value: remaining, color: "text-sky-400" },
          { label: "Complete", value: `${pct}%`, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sky-500 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or vehicle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {search ? "No customers match your search" : "All customers have phone numbers! 🎉"}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">#</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Vehicle</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Phone Number</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const phone = phoneInputs[c.id] || "";
                const isSaving = saving[c.id];
                const canSave = phone.trim().length >= 7;
                return (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-sm">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white text-sm">{c.full_name}</div>
                      {c.email && <div className="text-xs text-gray-500">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{getVehicle(c.id)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/50 text-red-400">
                        Missing
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="tel"
                        placeholder="e.g. 6131234567"
                        value={phone}
                        onChange={e => setPhoneInputs(p => ({ ...p, [c.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && canSave && handleSave(c)}
                        className="w-44 bg-gray-950 border-gray-700 text-white placeholder:text-gray-600 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        disabled={!canSave || isSaving}
                        onClick={() => handleSave(c)}
                        className="bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-30"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}