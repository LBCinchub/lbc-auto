import React from "react";
import OriginalInvoiceEditor from "@/components/invoices/OriginalInvoiceEditor";
import OriginalEstimateEditor from "@/components/estimates/OriginalEstimateEditor";
import RepairOrderDetail from "@/pages/RepairOrderDetail";
import { ProfileDocumentProvider } from "@/components/customers/ProfileDocumentContext";

// Invoice/estimate editors are capped to the layer's visible height, so the editor body is the one
// vertical scroller and its Save/Cancel bar stays on screen. Repair orders keep scrolling the layer.
const FRAME = "lbc-editor-frame flex max-h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900";

// The exact editors used by the Invoices, Estimates and Repair Orders pages,
// opened inside the customer profile so every action stays in this context.
export default function ProfileDocumentView({ doc, customerId, openDoc, closeDoc }) {
  return (
    <ProfileDocumentProvider value={{ customerId, openDoc, closeDoc }}>
      {doc.type === "invoice" && (
        <div className={FRAME}><OriginalInvoiceEditor key={doc.id} source={{ type: "invoice", id: doc.id }} onClose={() => closeDoc()} /></div>
      )}
      {doc.type === "estimate" && (
        <div className={FRAME}><OriginalEstimateEditor key={doc.id} estimateId={doc.id} onClose={() => closeDoc()} /></div>
      )}
      {doc.type === "repair_order" && <RepairOrderDetail key={doc.id} orderId={doc.id} />}
    </ProfileDocumentProvider>
  );
}