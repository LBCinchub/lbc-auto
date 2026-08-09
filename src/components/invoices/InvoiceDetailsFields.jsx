import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function InvoiceDetailsFields({ draft, onChange }) {
  const set = (field, value) => onChange({ ...draft, [field]: value });
  return <div className="grid gap-4 border-b border-gray-800 pb-5 md:grid-cols-2">
    <div><Label className="text-gray-300">Invoice Date</Label><Input type="date" value={draft.invoice_date || ""} onChange={e => set("invoice_date", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" /></div>
    <div><Label className="text-gray-300">Due Date</Label><Input type="date" value={draft.due_date || ""} onChange={e => set("due_date", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" /></div>
    <div className="md:col-span-2"><Label className="text-gray-300">Service Description</Label><Textarea value={draft.service_reason || ""} onChange={e => set("service_reason", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" /></div>
    <div className="md:col-span-2"><Label className="text-gray-300">Customer Note</Label><Textarea value={draft.customer_note || ""} onChange={e => set("customer_note", e.target.value)} className="mt-2 border-gray-700 bg-gray-950 text-white" /></div>
  </div>;
}