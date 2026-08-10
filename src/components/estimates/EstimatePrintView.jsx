import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import PrintTemplate from "@/components/shared/PrintTemplate";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";

export default function EstimatePrintView({ estimate, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [user, setUser] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (estimate?.customer_id) setCustomer(await base44.entities.Customer.get(estimate.customer_id).catch(() => null));
      if (estimate?.vehicle_id) setVehicleData(await base44.entities.Vehicle.get(estimate.vehicle_id).catch(() => null));
    };
    loadData();
  }, [estimate]);

  const lineItems = [];
  (estimate?.parts_items || []).forEach(p => {
    lineItems.push({
      name: p.name || "",
      description: p.details || (p.part_number ? `Part #: ${p.part_number}` : ""),
      unit_price: p.unit_price || 0,
      qty: p.quantity || 1,
      amount: p.total || 0,
    });
  });
  (estimate?.labor_items || []).forEach(l => {
    lineItems.push({
      name: l.description || "",
      description: l.details || `${l.hours}h @ $${l.rate}/h`,
      unit_price: l.rate || 0,
      qty: l.hours || 0,
      amount: l.total || 0,
    });
  });

  // Exclude any line item that duplicates the Service Description / Notes
  // (those live in their own boxes) so the items table only shows real Labor/Part rows.
  const _norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const _sr = _norm(estimate?.service_reason);
  const _notes = _norm(estimate?.notes);
  const filteredLineItems = lineItems.filter((item) => {
    const n = _norm(item.name || item.description || "");
    return !((_sr && n === _sr) || (_notes && n === _notes));
  });

  const grandTotal = estimate?.grand_total || 0;
  const amountPaid = estimate?.amount_paid || 0;
  const financials = {
    partsTotal: estimate?.parts_total || 0,
    laborTotal: estimate?.labor_total || 0,
    subtotal: (estimate?.parts_total || 0) + (estimate?.labor_total || 0),
    discount: estimate?.discount || 0,
    discountType: estimate?.discount_type || "$",
    taxRate: estimate?.tax_rate || 0,
    taxAmount: estimate?.tax_amount || 0,
    taxAppliesTo: estimate?.tax_applies_to || "both",
    grandTotal,
    amountPaid,
    balanceDue: grandTotal - amountPaid,
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Estimate Preview</DialogTitle>
        </DialogHeader>
        <PrintTemplate
          type="Estimate"
          docNumber={estimate?.estimate_number}
          createdDate={estimate?.estimate_date || (estimate?.created_date ? new Date(estimate.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "")}
          user={user}
          customer={{ name: estimate?.customer_name || customer?.full_name, phone: customer?.phone, email: customer?.email, address: customer?.address }}
          vehicle={{ ...vehicleData, info: buildVehicleInfo(vehicleData) || estimate?.vehicle_info }}
          lineItems={filteredLineItems}
          paymentHistory={[]}
          financials={financials}
          notes={estimate?.notes}
          serviceReason={estimate?.service_reason}
        />
      </DialogContent>
    </Dialog>
  );
}