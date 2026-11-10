import React, { useState } from "react";
import { Loader2, MessageSquareText, Paperclip, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DeliveryStatusLine from "./DeliveryStatusLine";
import TextDetailsPanel from "./TextDetailsPanel";
import useDocumentDelivery from "./useDocumentDelivery";
import { pdfState } from "./deliveryUi";

// Explicit staff action: text the saved document to its own customer, as a PDF attachment or
// ("Send As Text") as readable details. Neither option includes a link; nothing sends without a click.
export default function TextPdfDialog({ documentType, documentId, onClose }) {
  const { info, delivery, error, sending, send } = useDocumentDelivery(documentType, documentId);
  const [mode, setMode] = useState("pdf");
  const [textBusy, setTextBusy] = useState(false);
  const label = documentType === "invoice" ? "Invoice" : "Estimate";
  const st = pdfState(info, delivery, sending);
  const busy = sending || textBusy;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "pdf" ? <><Smartphone className="h-5 w-5 text-sky-400" /> Text {label} PDF</> : <><MessageSquareText className="h-5 w-5 text-emerald-400" /> Send {label} As Text</>}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {mode === "pdf" ? `Sends the saved ${label.toLowerCase()} as a PDF attachment. No links are included.` : `Sends the saved ${label.toLowerCase()}'s details as a readable text message. No PDF, no links, no login.`}
          </DialogDescription>
        </DialogHeader>
        {mode === "text" ? (
          <TextDetailsPanel documentType={documentType} documentId={documentId} onBack={() => setMode("pdf")} onClose={onClose} onBusy={setTextBusy} />
        ) : (
          <>
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
                {delivery && <div><p className="mb-1 text-xs text-gray-500">{st.sentThisWindow ? "This send" : "Last send"}</p><DeliveryStatusLine delivery={delivery} /></div>}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
            {(st.pdfFailed || (info && !info.sender_ready)) && (
              <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">{st.pdfFailed ? "The PDF didn't go through." : "The PDF can't be texted right now."} You can send the {label.toLowerCase()} details as a readable text instead. You'll see the exact message before anything is sent.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" className="border-gray-700 bg-transparent" onClick={onClose} disabled={sending}>Close</Button>
              <Button variant="outline" onClick={() => setMode("text")} disabled={!st.canOpenText}
                className={st.pdfFailed ? "border-emerald-500 bg-emerald-700 text-white hover:bg-emerald-600" : "border-gray-700 bg-transparent text-emerald-300"}>
                <MessageSquareText /> Send As Text
              </Button>
              {st.showSendPdf && (
                <Button onClick={send} disabled={!st.canSendPdf} className="bg-sky-600 hover:bg-sky-500">
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send PDF"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}