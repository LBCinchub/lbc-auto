import React from "react";

// One payment-method group: invoice rows (click to open the invoice) and a subtotal.
export default function PaymentGroupTable({ group, onOpenInvoice }) {
  return (
    <div>
      <div className="text-xs font-bold text-gray-300 uppercase tracking-wider px-1 mb-1">{group.label}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left text-xs text-gray-500 px-3 py-1.5">Invoice #</th>
            <th className="text-left text-xs text-gray-500 px-3 py-1.5">Customer</th>
            <th className="text-left text-xs text-gray-500 px-3 py-1.5">Vehicle</th>
            <th className="text-right text-xs text-gray-500 px-3 py-1.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {group.payments.map((p, i) => (
            <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer"
              onClick={() => onOpenInvoice(p.invoice.id)}>
              <td className="px-3 py-2 text-sky-400 font-mono font-semibold">{p.invoice.invoice_number || p.invoice.id.slice(0, 8)}</td>
              <td className="px-3 py-2 text-gray-200">{p.invoice.customer_name}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{p.invoice.vehicle_info || "—"}</td>
              <td className="px-3 py-2 text-right text-emerald-400 font-semibold">${p.amount.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="bg-gray-800/40">
            <td colSpan={3} className="px-3 py-1.5 text-gray-400 text-xs font-semibold">Subtotal</td>
            <td className="px-3 py-1.5 text-right text-emerald-300 font-semibold text-xs">
              ${group.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}