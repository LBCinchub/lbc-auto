import React from "react";
import OriginalInvoiceEditor from "@/components/invoices/OriginalInvoiceEditor";
import OriginalEstimateEditor from "@/components/estimates/OriginalEstimateEditor";
import RepairOrderDetail from "@/pages/RepairOrderDetail";
import { ProfileDocumentProvider } from "@/components/customers/ProfileDocumentContext";

// No overflow clipping here: the editor's sticky action bar sticks to the layer's single scroller.
const FRAME = "rounded-xl border border-gray-800 bg-gray-900";

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