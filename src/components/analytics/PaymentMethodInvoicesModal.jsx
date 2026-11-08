import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dayPayments, groupPayments } from "@/lib/dayPayments";
import PaymentGroupTable from "./PaymentGroupTable";

// Payments for the selected day and method — uses amount_paid per invoice, grouped by method.
export default function PaymentMethodInvoicesModal({ method, onClose, selectedDay, today, invoices }) {
  const { filtered, groups } = method ? groupPayments(dayPayments(invoices, selectedDay), method) : { filtered: [], groups: [] };
  const grandTotal = filtered.reduce((s, p) => s + p.amount, 0);
  const openInvoice = (id) => { onClose(); window.location.href = `/InvoiceDetail/${id}`; };

  return (
    <Dialog open={!!method} onOpenChange={() => onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {method === "all" ? "All Methods" : method === "etransfer" ? "E-Transfer" : method} — {selectedDay === today ? "Today" : selectedDay}
          </DialogTitle>
        </DialogHeader>
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No payments found for this date / method.</p>
        ) : (
          <div className="space-y-4 mt-2">
            {groups.map(group => <PaymentGroupTable key={group.key} group={group} onOpenInvoice={openInvoice} />)}
            <div className="flex justify-between items-center border-t-2 border-gray-600 pt-3 px-1">
              <span className="text-gray-300 font-bold text-sm">Grand Total</span>
              <span className="text-emerald-400 font-bold text-lg">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}