import React, { useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export default function InvoicePrintView({ invoice, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Invoice ${invoice.invoice_number}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .logo { font-size: 24px; font-weight: bold; }
        .logo span { color: #0ea5e9; }
        .info { text-align: right; }
        .info h2 { font-size: 28px; color: #0ea5e9; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        .totals { text-align: right; margin-top: 20px; }
        .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; }
        .totals .total { font-size: 20px; font-weight: bold; color: #0ea5e9; border-top: 2px solid #0ea5e9; padding-top: 8px; }
        .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; }
      </style></head><body>
      ${content.innerHTML}
      <div class="footer">LBC Auto · Powered by Lumina Blockchain</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Invoice Preview</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="bg-sky-500 hover:bg-sky-600 gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div ref={printRef} className="p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold">LBC <span className="text-sky-500">Auto</span></h1>
              <p className="text-sm text-gray-500 mt-1">Smart Management</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-sky-500">INVOICE</h2>
              <p className="text-sm text-gray-600 mt-1">{invoice.invoice_number}</p>
              <p className="text-sm text-gray-600">
                {invoice.created_date ? new Date(invoice.created_date).toLocaleDateString() : ""}
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="font-semibold">{invoice.customer_name}</p>
            <p className="text-sm text-gray-600">{invoice.vehicle_info}</p>
          </div>

          <table className="w-full mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Description</th>
                <th className="text-right p-3 text-xs text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.labor_total > 0 && (
                <tr className="border-b">
                  <td className="p-3">Labor</td>
                  <td className="p-3 text-right">${invoice.labor_total?.toFixed(2)}</td>
                </tr>
              )}
              {invoice.parts_total > 0 && (
                <tr className="border-b">
                  <td className="p-3">Parts</td>
                  <td className="p-3 text-right">${invoice.parts_total?.toFixed(2)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-col items-end space-y-1">
            <div className="flex gap-8 text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${((invoice.parts_total || 0) + (invoice.labor_total || 0)).toFixed(2)}</span>
            </div>
            <div className="flex gap-8 text-sm">
              <span className="text-gray-500">Tax ({invoice.tax_rate || 0}%)</span>
              <span>${(invoice.tax_amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex gap-8 text-lg font-bold border-t-2 border-sky-500 pt-2 mt-2">
              <span>Total</span>
              <span className="text-sky-500">${invoice.total?.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-gray-400">
            {invoice.status === "paid" ? "✓ PAID" : invoice.due_date ? `Due: ${invoice.due_date}` : "UNPAID"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}