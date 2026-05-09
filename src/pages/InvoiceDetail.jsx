import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Store, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { formatPhone } from "@/utils/formatPhone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import PrintTemplate from "@/components/shared/PrintTemplate";



export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Editable line item state
  const [laborItems, setLaborItems] = useState([]);
  const [partsItems, setPartsItems] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser);
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

  // Initialize editable state from invoice data once loaded
  useEffect(() => {
    if (invoice && !initialized) {
      const lineItems = invoice.line_items || [];
      setLaborItems(
        lineItems
          .filter(i => i.type === "labor")
          .map(i => ({ description: i.description || "", hours: i.quantity || 0, rate: i.unit_price || 0, total: i.total || 0 }))
      );
      setPartsItems(
        lineItems
          .filter(i => i.type !== "labor")
          .map(i => ({ name: i.description || "", quantity: i.quantity || 1, unit_price: i.unit_price || 0, total: i.total || 0 }))
      );
      setInitialized(true);
    }
  }, [invoice, initialized]);

  // Calculations
  const laborTotal = laborItems.reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0), 0);
  const partsTotal = partsItems.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0), 0);
  const subtotal = laborTotal + partsTotal;
  const taxRate = invoice?.tax_rate ?? (user?.tax_rate ?? 0);
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const updateLabor = (idx, field, value) => {
    setLaborItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      updated.total = (parseFloat(updated.hours) || 0) * (parseFloat(updated.rate) || 0);
      return updated;
    }));
  };

  const updatePart = (idx, field, value) => {
    setPartsItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
      return updated;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const line_items = [
      ...laborItems.map(r => ({
        type: "labor",
        description: r.description,
        quantity: parseFloat(r.hours) || 0,
        unit_price: parseFloat(r.rate) || 0,
        total: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0),
      })),
      ...partsItems.map(r => ({
        type: "part",
        description: r.name,
        quantity: parseFloat(r.quantity) || 1,
        unit_price: parseFloat(r.unit_price) || 0,
        total: (parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0),
      })),
    ];
    const newTax = subtotal * (taxRate / 100);
    const newTotal = subtotal + newTax;
    const amountPaid = invoice.amount_paid || 0;
    await base44.entities.Invoice.update(invoiceId, {
      line_items,
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_amount: newTax,
      total: newTotal,
      balance_due: Math.max(0, newTotal - amountPaid),
    });
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    setSaving(false);
  };



  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/Invoices")} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
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

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate("/Invoices")} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Button>
        <div className="flex gap-2">
          {invoice?.repair_order_id && (
            <Button variant="outline" onClick={() => navigate(`/RepairOrderDetail/${invoice.repair_order_id}`)}
              className="border-gray-700 text-gray-300">
              View Repair Order
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Print Preview — same style as Estimates */}
      <div className="rounded-xl border border-gray-800/50 bg-white p-8">
        <PrintTemplate
          type="Invoice"
          docNumber={invoice.invoice_number}
          createdDate={new Date(invoice.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          user={user}
          customer={{ name: invoice.customer_name, phone: customer?.phone, email: customer?.email }}
          vehicle={{ info: invoice.vehicle_info }}
          lineItems={[
            ...(laborItems.map(r => ({
              name: r.description || "Labor",
              description: `${r.hours}h @ $${parseFloat(r.rate || 0).toFixed(2)}/hr`,
              unit_price: parseFloat(r.rate) || 0,
              qty: parseFloat(r.hours) || 0,
              amount: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0),
            }))),
            ...(partsItems.map(r => ({
              name: r.name || "Part",
              description: "",
              unit_price: parseFloat(r.unit_price) || 0,
              qty: parseFloat(r.quantity) || 1,
              amount: (parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0),
            }))),
          ]}
          paymentHistory={invoice.payment_history || []}
          financials={{
            partsTotal,
            laborTotal,
            subtotal: laborTotal + partsTotal,
            taxRate,
            taxAmount,
            grandTotal,
            amountPaid: invoice.amount_paid || 0,
            balanceDue: invoice.balance_due || 0,
          }}
          notes={invoice.customer_note}
        />
      </div>

      {/* Editable Line Items */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-6">
        {/* Invoice Header — matches screenshot layout */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sky-400 text-sm font-semibold mb-0.5">{customer?.full_name || invoice.customer_name}</p>
            <h1 className="text-3xl font-bold text-white">Invoice #{invoice.invoice_number}</h1>
            <p className="text-gray-400 mt-1">{invoice.customer_name}</p>
            {(invoice.customer_phone || customer?.phone) && (
              <a href={`tel:${invoice.customer_phone || customer?.phone}`}
                className="text-sky-400 hover:text-sky-300 text-sm font-semibold mt-1 inline-flex items-center gap-1">
                📞 {formatPhone(invoice.customer_phone || customer?.phone)}
              </a>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            invoice.status === "paid" ? "bg-green-500/20 text-green-400"
            : invoice.status === "partial" ? "bg-yellow-500/20 text-yellow-400"
            : invoice.status === "overdue" ? "bg-red-500/20 text-red-400"
            : "bg-gray-500/20 text-gray-400"
          }`}>
            {invoice.status}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-800">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
            <p className="text-white font-bold text-sm">{invoice.vehicle_info || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Customer</p>
            <p className="text-white font-bold text-sm">{customer?.full_name || invoice.customer_name || "—"}</p>
            {customer?.phone && <p className="text-sky-400 text-xs">{formatPhone(customer.phone)}</p>}
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Due Date</p>
            <p className="text-white text-sm">{invoice.due_date ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString() : "N/A"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Amount Paid</p>
            <p className="text-emerald-400 font-semibold text-sm">${(invoice.amount_paid || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Balance Due</p>
            <p className={`font-bold text-sm ${invoice.balance_due > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
              ${(invoice.balance_due || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Labor Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Labor</h2>
            <Button size="sm" variant="ghost" onClick={() => setLaborItems(p => [...p, { description: "", hours: 0, rate: 0, total: 0 }])}
              className="text-sky-400 hover:text-sky-300 h-7 px-2">
              <Plus className="w-4 h-4 mr-1" /> Add Labor
            </Button>
          </div>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right w-20">Hours</th>
                  <th className="px-3 py-2 text-right w-24">Rate/hr</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {laborItems.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-600 text-xs">No labor items — click Add Labor</td></tr>
                )}
                {laborItems.map((row, idx) => (
                  <tr key={idx} className="bg-gray-900">
                    <td className="px-2 py-1.5">
                      <Input value={row.description} onChange={e => updateLabor(idx, "description", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Engine Diagnosis" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.hours} onChange={e => updateLabor(idx, "hours", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" step="0.5" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.rate} onChange={e => updateLabor(idx, "rate", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-medium">
                      ${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}
                    </td>
                    <td className="pr-2 py-1.5 text-center">
                      <button onClick={() => setLaborItems(p => p.filter((_, i) => i !== idx))}
                        className="text-gray-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Parts Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Parts</h2>
            <Button size="sm" variant="ghost" onClick={() => setPartsItems(p => [...p, { name: "", quantity: 1, unit_price: 0, total: 0 }])}
              className="text-sky-400 hover:text-sky-300 h-7 px-2">
              <Plus className="w-4 h-4 mr-1" /> Add Part
            </Button>
          </div>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Part Name</th>
                  <th className="px-3 py-2 text-right w-20">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Unit Price</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {partsItems.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-600 text-xs">No parts — click Add Part</td></tr>
                )}
                {partsItems.map((row, idx) => (
                  <tr key={idx} className="bg-gray-900">
                    <td className="px-2 py-1.5">
                      <Input value={row.name} onChange={e => updatePart(idx, "name", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.quantity} onChange={e => updatePart(idx, "quantity", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.unit_price} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0.00" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-medium">
                      ${((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toFixed(2)}
                    </td>
                    <td className="pr-2 py-1.5 text-center">
                      <button onClick={() => setPartsItems(p => p.filter((_, i) => i !== idx))}
                        className="text-gray-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
          {/* Individual labor items */}
          {laborItems.map((row, idx) => (
            <div key={`l-${idx}`} className="flex justify-between text-gray-400">
              <span>{row.description || "Labor"} <span className="text-gray-600 text-xs">({row.hours}h × ${parseFloat(row.rate || 0).toFixed(2)}/hr)</span></span>
              <span>${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}</span>
            </div>
          ))}
          {/* Individual parts items */}
          {partsItems.map((row, idx) => (
            <div key={`p-${idx}`} className="flex justify-between text-gray-400">
              <span>{row.name || "Part"} <span className="text-gray-600 text-xs">(x{row.quantity})</span></span>
              <span>${((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toFixed(2)}</span>
            </div>
          ))}
          {taxRate > 0 && (
            <div className="flex justify-between text-gray-400 border-t border-gray-700/50 pt-2"><span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-white font-bold text-base border-t border-gray-700 pt-2">
            <span>Grand Total</span>
            <span className="text-sky-400">${grandTotal.toFixed(2)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div className="flex justify-between text-emerald-400"><span>Amount Paid</span><span>${(invoice.amount_paid || 0).toFixed(2)}</span></div>
          )}
          {invoice.balance_due > 0 && (
            <div className="flex justify-between text-yellow-400 font-semibold">
              <span>Balance Due</span><span>${invoice.balance_due.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Parts & Suppliers (read-only, for warranty) */}
        {invoice.parts_used && invoice.parts_used.length > 0 && (
          <div className="pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-4 h-4 text-sky-400" />
              <h3 className="text-white font-semibold">Parts & Suppliers</h3>
              <span className="text-xs text-gray-500">(warranty tracking)</span>
            </div>
            <div className="space-y-2">
              {invoice.parts_used.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-white text-sm font-medium">{p.name} <span className="text-gray-500">x{p.quantity}</span></p>
                    {p.supplier
                      ? <p className="text-sky-400 text-xs mt-0.5 flex items-center gap-1"><Store className="w-3 h-3" /> {p.supplier}</p>
                      : <p className="text-gray-600 text-xs mt-0.5 italic">No supplier recorded</p>
                    }
                  </div>
                  <span className="text-gray-300 text-sm">${(p.total || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.customer_note && (
          <div className="pt-4 border-t border-gray-800">
            <h3 className="text-white font-semibold mb-2">Customer Note</h3>
            <p className="text-gray-300 text-sm">{invoice.customer_note}</p>
          </div>
        )}
      </div>{/* end editable section */}
    </div>
  );
}