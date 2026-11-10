import React from "react";
import { DollarSign, FileText, Loader2, Printer, Save, Send, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import TextPdfButton from "@/components/document-delivery/TextPdfButton";

export default function EstimateEditorActions({
  estimateId, saving, sending, hasLinkedInvoice, hasLinkedRO, extraActions,
  onCancel, onSave, onPrint, onSend, onPayment, onViewInvoice, onConvertRO, onViewRO,
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
      <div className="flex flex-wrap gap-2">
        {extraActions}
        <Button variant="outline" onClick={onPrint}><Printer /> Print</Button>
        <Button variant="outline" onClick={onSend} disabled={sending}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Emailing…" : "Email Estimate"}
        </Button>
        {estimateId && <TextPdfButton documentType="estimate" documentId={estimateId} size="default" />}
        <Button variant="outline" onClick={onPayment}><DollarSign /> Record Payment</Button>
        {hasLinkedInvoice && (
          <Button variant="outline" onClick={onViewInvoice}><FileText /> View Invoice</Button>
        )}
        {!hasLinkedRO && (
          <Button variant="outline" onClick={onConvertRO}><Wrench /> Convert to RO</Button>
        )}
        {hasLinkedRO && (
          <Button variant="outline" onClick={onViewRO}><FileText /> View RO</Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : "Save Estimate"}
        </Button>
      </div>
    </div>
  );
}