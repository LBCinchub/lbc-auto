import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function InvoiceSourcePicker({ customers, vehicles, onSelect, onClose }) {
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const available = useMemo(() => vehicles.filter(v => v.customer_id === customerId), [vehicles, customerId]);
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
    <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
    <div className="space-y-4 py-2">
      <div><Label className="text-gray-300">Customer</Label><select value={customerId} onChange={e => { setCustomerId(e.target.value); setVehicleId(""); }} className="mt-2 h-10 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-sm"><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
      <div><Label className="text-gray-300">Vehicle</Label><select value={vehicleId} disabled={!customerId} onChange={e => setVehicleId(e.target.value)} className="mt-2 h-10 w-full rounded-md border border-gray-700 bg-gray-950 px-3 text-sm disabled:opacity-50"><option value="">Select vehicle</option>{available.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}</select></div>
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!vehicleId} onClick={() => onSelect({ type: "vehicle", id: vehicleId })} className="bg-sky-500 hover:bg-sky-600">Continue</Button></DialogFooter>
  </DialogContent></Dialog>;
}