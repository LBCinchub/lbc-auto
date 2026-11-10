import React from "react";

// One payment-method group: invoice rows (click to open the invoice) and a subtotal.
export default function PaymentGroupTable({ group, onOpenInvoice }) {
  return (
    <div>
      <div className="text-xs font-bold text-gray-300 uppercase tracking-wider px-1 mb-1">{group.label}</div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
...
      </table>
      </div>
    </div>
  );
}