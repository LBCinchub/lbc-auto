import React from "react";
import { Loader2, Paperclip, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DeliveryStatusLine from "./DeliveryStatusLine";
import useDocumentDelivery from "./useDocumentDelivery";

// Explicit staff action: text the saved document as a PDF attachment to that document's customer.
export default function TextPdfDialog({ documentType, documentId, onClose }) {
  const { info, delivery, error, sending, send } = useDocumentDelivery(documentType, documentId);
  const label = documentType === "invoice" ? "Invoice" : "Estimate";
  const inFlight = ["preparing", "queued", "sending"].includes(delivery?.status);
  const sentThisWindow = delivery && info?.latest?.id !== delivery.id;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !sending) onClose(); }}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-sky-400" /> Text {label} PDF</DialogTitle>
          <DialogDescription className="text-gray-400">Sends the saved {label.toLowerCase()} as a PDF attachment. No links are included.</DialogDescription>
        </DialogHeader>
        {!info && !error && <p className="flex items-center gap-2 py-6 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking the document and texting setup…</p>}
        {info && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-300">To <strong className="text-white">{info.customer_name}</strong> at <strong className="text-white">{info.to}</strong></p>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-gray-300">
              <p>{info.message}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500"><Paperclip className="h-3.5 w-3.5" /> {info.document_number || label}.pdf</p>
            </div>
            {!info.sender_ready && <p role="alert" className="text-amber-300">{info.sender_problem} The PDF can't be texted until this is fixed.</p>}
            <p className="text-xs text-gray-500">Some carriers limit or block PDF picture messages. "Delivered" only shows once the carrier confirms it.</p>
            {delivery && <div><p className="mb-1 text-xs text-gray-500">{sentThisWindow ? "This send" : "Last send"}</p><DeliveryStatusLine delivery={delivery} /></div>}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="border-gray-700 bg-transparent" onClick={onClose} disabled={sending}>Close</Button>
          {info && !sentThisWindow && (
            <Button onClick={send} disabled={sending || !info.sender_ready || inFlight} className="bg-sky-600 hover:bg-sky-500">
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send PDF"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}