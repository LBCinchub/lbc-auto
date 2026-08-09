import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function EstimateDetailsFields({ draft, onChange }) {
  const set = (field, value) => onChange({ ...draft, [field]: value });
  return (
    <div className="grid gap-4 border-b border-gray-800 pb-5 md:grid-cols-2">
      <div>
        <Label className="text-gray-300">Estimate Date</Label>
        <Input type="date" value={draft.estimate_date || ""} onChange={e => set("estimate_date", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" />
      </div>
      <div>
        <Label className="text-gray-300">Valid Until</Label>
        <Input type="date" value={draft.valid_until || ""} onChange={e => set("valid_until", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" />
      </div>
      <div className="md:col-span-2">
        <Label className="text-gray-300">Service Description</Label>
        <Textarea value={draft.service_reason || ""} onChange={e => set("service_reason", e.target.value)} className="mt-2 flex min-h-[60px] w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </div>
      <div className="md:col-span-2">
        <Label className="text-gray-300">Notes (shown on print)</Label>
        <Textarea value={draft.notes || ""} onChange={e => set("notes", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" />
      </div>
    </div>
  );
}