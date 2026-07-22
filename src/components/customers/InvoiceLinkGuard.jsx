import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function InvoiceLinkGuard({ invoice, vehicles, repairOrders, onRelink }) {
  const brokenRO = !!invoice.repair_order_id && !repairOrders.some(ro => ro.id === invoice.repair_order_id);
  const missingVehicle = !invoice.vehicle_id && !!invoice.vehicle_info;
  const [vehicleId, setVehicleId] = useState("");
  const [repairOrderId, setRepairOrderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!brokenRO && !missingVehicle) return null;

  const save = async () => {
    setSaving(true); setError("");
    try {
      const patch = {};
      if (missingVehicle && vehicleId) patch.vehicle_id = vehicleId;
      if (brokenRO && repairOrderId) patch.repair_order_id = repairOrderId;
      if (!Object.keys(patch).length) throw new Error("Select a matching record first.");
      await base44.entities.Invoice.update(invoice.id, patch);
      onRelink?.();
    } catch (e) { setError(e?.message || "Could not relink invoice."); }
    finally { setSaving(false); }
  };

  return <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2" onClick={e => e.stopPropagation()}>
    <p className="text-xs font-semibold text-amber-400">Unlinked invoice — choose this customer’s matching record</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {missingVehicle && <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"><option value="">Select vehicle</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}</select>}
      {brokenRO && <select value={repairOrderId} onChange={e => setRepairOrderId(e.target.value)} className="rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white"><option value="">Select repair order</option>{repairOrders.map(ro => <option key={ro.id} value={ro.id}>#{ro.order_number} — {ro.vehicle_info}</option>)}</select>}
      <Button size="sm" onClick={save} disabled={saving} className="h-7 bg-amber-600 hover:bg-amber-500">{saving ? "Relinking..." : "Relink"}</Button>
    </div>
    {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
  </div>;
}