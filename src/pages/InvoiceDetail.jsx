import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => base44.entities.Invoice.get(invoiceId),
    enabled: !!invoiceId,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", invoice?.customer_id],
    queryFn: () => base44.entities.Customer.get(invoice.customer_id),
    enabled: !!invoice?.customer_id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Invoice not found</p>
      </div>
    );
  }

  const serviceItems = invoice.line_items?.filter(item => item.type === "service") || [];
  const laborItems = invoice.line_items?.filter(item => item.type === "labor") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        {invoice?.repair_order_id ? (
          <Button onClick={() => navigate(`/RepairOrderDetail/${invoice.repair_order_id}`)} className="bg-sky-500 hover:bg-sky-600">
            View Repair Order
          </Button>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            {user?.business_name && <h2 className="text-sm font-semibold text-sky-400 mb-2">{user.business_name}</h2>}
            <h1 className="text-3xl font-bold text-white">Invoice #{invoice.invoice_number}</h1>
            <p className="text-gray-400 mt-1">{invoice.customer_name}</p>
            {customer?.phone && <p className="text-gray-500 text-sm mt-1">{customer.phone}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            invoice.status === "paid"
              ? "bg-green-500/20 text-green-400"
              : invoice.status === "partial"
              ? "bg-yellow-500/20 text-yellow-400"
              : invoice.status === "overdue"
              ? "bg-red-500/20 text-red-400"
              : "bg-gray-500/20 text-gray-400"
          }`}>
            {invoice.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
            <p className="text-white font-semibold">{invoice.vehicle_info}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Repair Order</p>
            <p className="text-white">{invoice.repair_order_id}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Due Date</p>
            <p className="text-white">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Amount Paid</p>
            <p className="text-white font-semibold">${invoice.amount_paid?.toFixed(2) || "0.00"}</p>
          </div>
        </div>

        {(laborItems.length > 0 || serviceItems.length > 0) && (
          <div className="border-t border-gray-800 pt-6 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Line Items</h2>
            <div className="space-y-2">
              {laborItems.map((item, idx) => (
                <div key={`labor-${idx}`} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{item.description}</p>
                    <p className="text-gray-400 text-sm">Labor</p>
                  </div>
                  <p className="text-white font-semibold">${item.total?.toFixed(2)}</p>
                </div>
              ))}
              {serviceItems.map((item, idx) => (
                <div key={`service-${idx}`} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{item.description}</p>
                    <p className="text-gray-400 text-sm">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-white font-semibold">${item.total?.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-800 pt-6 space-y-3">
          <div className="flex justify-between text-gray-300">
            <span>Subtotal:</span>
            <span>${(invoice.parts_total + invoice.labor_total)?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Tax ({invoice.tax_rate}%):</span>
            <span>${invoice.tax_amount?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="flex justify-between text-white text-lg font-bold border-t border-gray-800 pt-3">
            <span>Total:</span>
            <span>${invoice.total?.toFixed(2) || "0.00"}</span>
          </div>
          {invoice.balance_due > 0 && (
            <div className="flex justify-between text-yellow-400 font-semibold">
              <span>Balance Due:</span>
              <span>${invoice.balance_due?.toFixed(2)}</span>
            </div>
          )}
        </div>

        {invoice.customer_note && (
          <div className="mt-6 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-bold text-white mb-3">Customer Note</h3>
            <p className="text-gray-300">{invoice.customer_note}</p>
          </div>
        )}
      </div>
    </div>
  );
}