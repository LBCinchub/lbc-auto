import React from "react";
import { DollarSign, Loader2, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoiceEditorActions({ invoice, saving, dirty, onCancel, onSave, onPrint, onPayment }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-5 py-4 md:px-6">
    <div className="flex gap-2">{invoice && <Button variant="outline" onClick={onPrint}><Printer /> Print</Button>}{invoice && invoice.status !== "paid" && <Button variant="outline" onClick={onPayment}><DollarSign /> Record Payment</Button>}</div>
    <div className="flex gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={onSave} disabled={saving || (!dirty && !!invoice)} className="bg-sky-500 hover:bg-sky-600">{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : "Save Invoice"}</Button></div>
  </div>;
}