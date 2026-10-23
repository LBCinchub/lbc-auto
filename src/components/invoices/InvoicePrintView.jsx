import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { TAX_RATE } from "@/lib/constants";
import { formatRecordDate } from "@/lib/printDate";
import PrintTemplate from "@/components/shared/PrintTemplate";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";
import { calcGhostTotals } from "@/utils/ghostTax";
import { shopContact, customerContact, loadInvoiceContacts } from "@/lib/printContacts";

export default function InvoicePrintView({ invoice, onClose }) {
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { user, customer, vehicle: vehicleData } = state.data || {};

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    loadInvoiceContacts({
      invoice,
      me: () => base44.auth.me(),
      getCustomer: (id) => base44.entities.Customer.get(id),
      getVehicle: (id) => base44.entities.Vehicle.get(id),
    })
      .then((data) => { if (current) setState({ status: "ready", data }); })
      .catch(() => { if (current) setState({ status: "error" }); });
    return () => { current = false; };
  }, [invoice?.id, invoice?.customer_id, invoice?.vehicle_id, attempt]);

  // Build line items from parts + labor — prefer the unified line_items (which
  // always carries both Labor and Parts from the estimate/RO), fall back to
  // the legacy parts_used/labor_items fields only when line_items lacks them.
  const lineItems = [];
  const lineItemParts = (invoice.line_items || []).filter(li => li.type === "part" || li.type === "parts");
  const partsRows = lineItemParts.length > 0
    ? lineItemParts
    : (invoice.parts_used || []);

  partsRows.forEach(p => {
    const isUnified = !!p.name;
    const descParts = [];
    if (isUnified && p.description) descParts.push(p.description);
    if (p.part_number) descParts.push(`Part #: ${p.part_number}`);
    if (p.supplier) descParts.push(`Supplier: ${p.supplier}`);
    lineItems.push({
      name: p.name || p.description || "",
      description: descParts.join(" · "),
      unit_price: p.unit_price || 0,
      qty: p.quantity || 1,
      amount: p.total || (p.unit_price || 0) * (p.quantity || 1),
      supplier: p.supplier || "",
      type: "part",
    });
  });

  const lineItemLabor = (invoice.line_items || []).filter(li => li.type === "labor");
  const laborRows = lineItemLabor.length > 0
    ? lineItemLabor
    : (invoice.labor_items || []);

  if (laborRows.length > 0) {
    laborRows.forEach(l => {
      const isUnified = !!l.name;
      const hours = l.hours || l.quantity || 0;
      const rate = l.rate || l.unit_price || 0;
      const autoDesc = hours ? `${hours}h @ $${rate}/h` : "";
      lineItems.push({
        name: l.name || l.description || "",
        description: isUnified ? (l.description || autoDesc) : autoDesc,
        unit_price: rate,
        qty: hours || 1,
        amount: l.total || 0,
        type: "labor",
      });
    });
  } else if (invoice.labor_total > 0) {
    lineItems.push({
      name: "Labor cost",
      description: "",
      unit_price: invoice.labor_total || 0,
      qty: 1,
      amount: invoice.labor_total || 0,
      type: "labor",
    });
  }

  // Exclude any line item that duplicates the Service Description / Customer Note
  // (those live in their own boxes) so the items table only shows real Labor/Part rows.
  const _norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const _sr = _norm(invoice.service_reason);
  const _cn = _norm(invoice.customer_note);
  const filteredLineItems = lineItems.filter((item) => {
    const n = _norm(item.name || item.description || "");
    return !((_sr && n === _sr) || (_cn && n === _cn));
  });

  const subtotal = (invoice.parts_total || 0) + (invoice.labor_total || 0);
  const financials = {
    partsTotal: invoice.parts_total || 0,
    laborTotal: invoice.labor_total || 0,
    subtotal,
    discount: invoice.discount || 0,
    taxRate: invoice.tax_rate ?? TAX_RATE,
    taxAmount: invoice.tax_amount || 0,
    taxAppliesTo: invoice.tax_applies_to || "both",
    grandTotal: invoice.total || 0,
    amountPaid: invoice.amount_paid || 0,
    balanceDue: invoice.balance_due ?? (invoice.total || 0),
  };

  const ghostItems = invoice?.ghost_status === "active" ? (invoice?.ghost_items || []) : [];
  const ghostTotals = ghostItems.length ? calcGhostTotals(ghostItems, invoice?.tax_rate || 0, invoice?.tax_applies_to || "both") : null;

  const paymentHistory = (invoice.payment_history || []).map(p => ({
    date: formatRecordDate(p.date),
    receipt_number: p.receipt_number || invoice.receipt_number || "",
    method: p.method || invoice.payment_method || "",
    amount: p.amount || 0,
  }));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>
        {state.status === "loading" && <p className="py-10 text-center text-sm text-gray-500">Loading Contact Details…</p>}
        {state.status === "error" && (
          <div className="py-10 text-center text-sm text-red-600">
            Could Not Load Contact Details. Printing Is Paused So Nothing Is Missing.
            <button className="ml-2 underline" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </div>
        )}
        {state.status === "ready" && <PrintTemplate
          type="Invoice"
          docNumber={invoice.invoice_number}
          createdDate={invoice.created_date ? new Date(invoice.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
          user={{ ...user, ...shopContact(user) }}
          customer={customerContact(customer, invoice)}
          vehicle={{ ...vehicleData, info: buildVehicleInfo(vehicleData) || invoice.vehicle_info }}
          lineItems={filteredLineItems}
          paymentHistory={paymentHistory}
          financials={financials}
          ghostItems={ghostItems}
          ghostTotals={ghostTotals}
          ghostNotes={invoice.ghost_notes}
          notes={invoice.customer_note}
          serviceReason={invoice.service_reason}
        />}
      </DialogContent>
    </Dialog>
  );
}