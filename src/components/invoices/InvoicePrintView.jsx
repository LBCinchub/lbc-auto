import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { TAX_RATE } from "@/lib/constants";
import PrintTemplate from "@/components/shared/PrintTemplate";

export default function InvoicePrintView({ invoice, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [user, setUser] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (invoice?.customer_id) {
        const cust = await base44.entities.Customer.get(invoice.customer_id);
        setCustomer(cust);
      }
      if (invoice?.vehicle_id) {
        const v = await base44.entities.Vehicle.get(invoice.vehicle_id).catch(() => null);
        setVehicleData(v);
      }
    };
    loadData();
  }, [invoice]);

  // Build line items from parts + labor
  const lineItems = [];
  const partsRows = (invoice.parts_used && invoice.parts_used.length > 0)
    ? invoice.parts_used
    : (invoice.line_items || []).filter(li => li.type === "part" || li.type === "parts");

  partsRows.forEach(p => {
    const descParts = [];
    if (p.part_number) descParts.push(`Part #: ${p.part_number}`);
    if (p.supplier) descParts.push(`Supplier: ${p.supplier}`);
    lineItems.push({
      name: p.name || p.description || "Part",
      description: descParts.join(" · "),
      unit_price: p.unit_price || 0,
      qty: p.quantity || 1,
      amount: p.total || (p.unit_price || 0) * (p.quantity || 1),
      supplier: p.supplier || "",
    });
  });

  const laborRows = (invoice.labor_items && invoice.labor_items.length > 0)
    ? invoice.labor_items
    : (invoice.line_items || []).filter(li => li.type === "labor");

  if (laborRows.length > 0) {
    laborRows.forEach(l => {
      lineItems.push({
        name: l.description || "Labor",
        description: l.hours ? `${l.hours}h @ $${l.rate}/h` : "",
        unit_price: l.rate || l.unit_price || 0,
        qty: l.hours || l.quantity || 1,
        amount: l.total || 0,
      });
    });
  } else if (invoice.labor_total > 0) {
    lineItems.push({
      name: "Labor cost",
      description: "",
      unit_price: invoice.labor_total || 0,
      qty: 1,
      amount: invoice.labor_total || 0,
    });
  }

  const subtotal = (invoice.parts_total || 0) + (invoice.labor_total || 0);
  const financials = {
    partsTotal: invoice.parts_total || 0,
    laborTotal: invoice.labor_total || 0,
    subtotal,
    taxRate: TAX_RATE,
    taxAmount: invoice.tax_amount || 0,
    taxAppliesTo: invoice.tax_applies_to || "both",
    grandTotal: invoice.total || 0,
    amountPaid: invoice.amount_paid || 0,
    balanceDue: invoice.balance_due ?? (invoice.total || 0),
  };

  const paymentHistory = (invoice.payment_history || []).map(p => ({
    date: p.date ? new Date(p.date).toLocaleString() : "",
    receipt_number: p.receipt_number || invoice.receipt_number || "",
    method: p.method || invoice.payment_method || "",
    amount: p.amount || 0,
  }));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Preview</DialogTitle>
        </DialogHeader>
        <PrintTemplate
          type="Invoice"
          docNumber={invoice.invoice_number}
          createdDate={invoice.created_date ? new Date(invoice.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
          user={user}
          customer={{ name: invoice.customer_name, phone: customer?.phone, email: customer?.email }}
          vehicle={{ info: invoice.vehicle_info, vin: vehicleData?.vin, mileage: vehicleData?.mileage, license_plate: vehicleData?.license_plate }}
          lineItems={lineItems}
          paymentHistory={paymentHistory}
          financials={financials}
          notes={invoice.customer_note}
        />
      </DialogContent>
    </Dialog>
  );
}