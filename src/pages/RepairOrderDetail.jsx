import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Trash2, MoreVertical, Clock, History, Wrench, PenLine, CheckCircle2, XCircle, Printer, ShoppingCart, Loader2 } from "lucide-react";
import { formatPhone } from "@/utils/formatPhone";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EstimateFormDialog from "@/components/estimates/EstimateFormDialog";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import SignaturePad from "@/components/orders/SignaturePad";
import PaymentHistoryManager from "@/components/invoices/PaymentHistoryManager";
import AutoAIBubble from "@/components/shared/AutoAIBubble";

export default function RepairOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);
  const [newPart, setNewPart] = useState({ name: "", quantity: "", unit_price: "" });
  const [showLaborDialog, setShowLaborDialog] = useState(false);
  const [newLabor, setNewLabor] = useState({ description: "", hours: "", rate: "" });
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showOrderedPartDialog, setShowOrderedPartDialog] = useState(false);
  const [showHistoryManager, setShowHistoryManager] = useState(false);
  const [newOrderedPart, setNewOrderedPart] = useState({ name: "", part_number: "", supplier: "", quantity: "", unit_price: "", notes: "" });
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["repairOrder", orderId],
    queryFn: () => base44.entities.RepairOrder.get(orderId),
    enabled: !!orderId,
  });

  const handlePrintWorkerCopy = () => {
    if (!order) return;
    const partsRows = (order.parts_used || []).map((p, i) => `
      <tr style="background:${i%2===1?"#fafbff":"white"};border-bottom:1px solid #f1f5f9">
        <td style="padding:12px;font-size:9px;color:#94a3b8">${i+1}</td>
        <td style="padding:12px;font-size:11px;font-weight:700;color:#0f172a">${p.name}</td>
        <td style="padding:12px;font-size:10px;color:#64748b">Part</td>
        <td style="padding:12px;text-align:center;font-size:10.5px;color:#334155">${p.quantity}</td>
        <td style="padding:12px;text-align:center"><div style="width:20px;height:20px;border:2px solid #cbd5e1;border-radius:4px;margin:0 auto"></div></td>
      </tr>`).join("");
    const laborRows = (order.labor_items || []).map((l, i) => `
      <tr style="background:${(i + (order.parts_used||[]).length)%2===1?"#fafbff":"white"};border-bottom:1px solid #f1f5f9">
        <td style="padding:12px;font-size:9px;color:#94a3b8">${(order.parts_used||[]).length+i+1}</td>
        <td style="padding:12px;font-size:11px;font-weight:700;color:#0f172a">${l.description}</td>
        <td style="padding:12px;font-size:10px;color:#64748b">Labor — ${l.hours}h</td>
        <td style="padding:12px;text-align:center;font-size:10.5px;color:#334155">${l.hours}h</td>
        <td style="padding:12px;text-align:center"><div style="width:20px;height:20px;border:2px solid #cbd5e1;border-radius:4px;margin:0 auto"></div></td>
      </tr>`).join("");
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>RO #${order.order_number} — Worker Copy</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a2e;background:white}.page{max-width:780px;margin:0 auto;padding:36px}table{width:100%;border-collapse:collapse}@media print{.page{padding:24px}}</style>
    </head><body><div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px">
        <div>
          <div style="font-size:22px;font-weight:700;color:#0f172a">Repair Order</div>
          <div style="font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-top:2px">Worker Copy</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:700;color:#0ea5e9;letter-spacing:-1px">RO #${order.order_number}</div>
          <div style="font-size:10px;color:#64748b;margin-top:4px">Date: ${new Date(order.created_date).toLocaleDateString()}</div>
          <div style="margin-top:8px;padding:4px 10px;background:#fef3c7;border-radius:6px;font-size:10px;font-weight:700;color:#92400e;display:inline-block">WORKER COPY — NO PRICES</div>
        </div>
      </div>
      <div style="height:3px;background:linear-gradient(to right,#0ea5e9,#6366f1,#ec4899);border-radius:2px;margin-bottom:24px"></div>
      <div style="display:flex;gap:20px;margin-bottom:28px">
        <div style="flex:1;background:#f8fafc;border-radius:10px;padding:14px 16px;border-left:3px solid #0ea5e9">
          <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Customer</div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px">${order.customer_name}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border-radius:10px;padding:14px 16px;border-left:3px solid #6366f1">
          <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Vehicle</div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px">${order.vehicle_info}</div>
          ${vehicleRecord?.license_plate ? `<div style="font-size:10px;color:#475569;font-weight:600;letter-spacing:0.5px">Plate: ${vehicleRecord.license_plate.toUpperCase()}</div>` : ""}
          ${vehicleRecord?.vin ? `<div style="font-size:9px;color:#64748b;font-family:monospace;margin-top:2px">VIN: ${vehicleRecord.vin.toUpperCase()}</div>` : ""}
          ${order.mechanic_name ? `<div style="font-size:10px;color:#475569;margin-top:2px">Mechanic: ${order.mechanic_name}</div>` : ""}
        </div>
      </div>
      ${order.description ? `<div style="margin-bottom:24px;background:#f8fafc;border-radius:8px;padding:14px;border-left:3px solid #94a3b8"><div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Description</div><div style="font-size:10.5px;color:#334155;line-height:1.6">${order.description}</div></div>` : ""}
      <table>
        <thead>
          <tr style="background:#0f172a">
            <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;width:5%">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Item / Task</th>
            <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Details</th>
            <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;width:12%">Qty</th>
            <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;width:14%">Done ✓</th>
          </tr>
        </thead>
        <tbody>${partsRows}${laborRows}</tbody>
      </table>
      ${order.notes ? `<div style="margin-top:24px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;padding:12px 14px"><div style="font-size:8px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">Notes</div><div style="font-size:10px;color:#78350f;line-height:1.6">${order.notes}</div></div>` : ""}
      <div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="height:36px;border-bottom:1.5px solid #cbd5e1;width:240px;margin-bottom:6px"></div>
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Mechanic Signature</div>
        </div>
        <div>
          <div style="height:36px;border-bottom:1.5px solid #cbd5e1;width:160px;margin-bottom:6px"></div>
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Date Completed</div>
        </div>
      </div>
    </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  // Full vehicle record (VIN, plate, color, engine, mileage) — parity with Estimate/Invoice detail pages
  const vehicleRecord = vehicles.find(v => v.id === order?.vehicle_id);

  const { data: customer } = useQuery({
    queryKey: ["customer", order?.customer_id],
    queryFn: () => base44.entities.Customer.get(order.customer_id),
    enabled: !!order?.customer_id,
  });

  // Fetch linked estimates and invoices
  const { data: linkedEstimates = [] } = useQuery({
    queryKey: ["estimates", "byRO", orderId],
    queryFn: () => base44.entities.Estimate.filter({ repair_order_id: orderId }),
    enabled: !!orderId,
  });

  const { data: linkedInvoicesList = [] } = useQuery({
    queryKey: ["invoices", "byRO", orderId],
    queryFn: () => base44.entities.Invoice.filter({ repair_order_id: orderId }),
    enabled: !!orderId,
  });

  // Fetch all repair orders for the same vehicle to show history
  const { data: allOrders = [] } = useQuery({
    queryKey: ["repairOrders", order?.vehicle_id],
    queryFn: () => base44.entities.RepairOrder.filter({ vehicle_id: order.vehicle_id }, "-created_date", 50),
    enabled: !!order?.vehicle_id,
  });

  const previousOrders = allOrders.filter(o => o.id !== orderId);

  const handleQuickGenerateInvoice = async () => {
    setGeneratingInvoice(true);
    try {
      const currentUser = await base44.auth.me();
      const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
      const laborItems = order.labor_items || [];
      const partsUsed = order.parts_used || [];
      const laborTotal = r2(laborItems.reduce((s, l) => s + (parseFloat(l.hours) || 0) * (parseFloat(l.rate) || 0), 0));
      const partsTotal = r2(partsUsed.reduce((s, p) => s + (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0), 0));
      const subtotal = r2(laborTotal + partsTotal);
      const taxRate = currentUser?.tax_rate || 0;
      const taxAmount = r2(subtotal * (taxRate / 100));
      const total = r2(subtotal + taxAmount);

      const lineItems = [
        ...laborItems.map(l => ({
          description: l.description || "Labor",
          type: "labor",
          quantity: parseFloat(l.hours) || 1,
          unit_price: parseFloat(l.rate) || 0,
          total: r2((parseFloat(l.hours) || 0) * (parseFloat(l.rate) || 0)),
        })),
        ...partsUsed.map(p => ({
          description: p.name || "Part",
          type: "part",
          quantity: parseFloat(p.quantity) || 1,
          unit_price: parseFloat(p.unit_price) || 0,
          total: r2((parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0)),
        })),
      ];

      const inv = await base44.entities.Invoice.create({
        invoice_number: `INV-${Date.now().toString(36).toUpperCase().slice(-8)}`,
        repair_order_id: order.id,
        customer_id: order.customer_id || "",
        customer_name: order.customer_name || "",
        vehicle_info: order.vehicle_info || "",
        line_items: lineItems,
        parts_total: partsTotal,
        labor_total: laborTotal,
        tax_rate: taxRate,
        tax_applies_to: "both",
        tax_amount: taxAmount,
        total,
        balance_due: total,
        amount_paid: 0,
        status: "unpaid",
        service_reason: order.description || "",
      });

      // Bug 3: Link the invoice back to the RO
      await base44.entities.RepairOrder.update(order.id, {
        linked_invoice_id: inv.id,
        linked_invoice_number: inv.invoice_number,
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", "byRO", orderId] });
      navigate(`/InvoiceDetail/${inv.id}`);
    } catch (err) {
      alert("Could not generate invoice: " + (err?.message || err));
    } finally {
      setGeneratingInvoice(false);
    }
  };

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

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Repair order not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky bottom-0 z-30 bg-gray-950 border-t border-gray-800 py-3 px-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handlePrintWorkerCopy} variant="outline" className="border-gray-700 text-gray-300 hover:text-white gap-2">
            <Printer className="w-4 h-4" /> Print Worker Copy
          </Button>
          <Button onClick={() => setShowEstimateDialog(true)} className="bg-green-600 hover:bg-green-700 gap-2">
            <Plus className="w-4 h-4" /> Create Estimate
          </Button>
          {linkedInvoicesList.length === 0 ? (
            <>
              <Button onClick={handleQuickGenerateInvoice} disabled={generatingInvoice}
                className={`gap-2 ${order.status === "completed" || order.status === "delivered"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-400/40"
                  : "bg-purple-600 hover:bg-purple-700"}`}>
                {generatingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {generatingInvoice ? "Generating..." : "Generate Invoice"}
              </Button>
              <Button onClick={() => setShowInvoiceDialog(true)} variant="outline"
                className="gap-2 border-gray-700 text-gray-300 hover:text-white">
                <FileText className="w-4 h-4" /> Custom Invoice
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate(`/InvoiceDetail/${linkedInvoicesList[0].id}`)} className="bg-purple-600 hover:bg-purple-700 gap-2">
                <FileText className="w-4 h-4" /> View Invoice
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowHistoryManager(true)} className="gap-2 border-gray-700 text-gray-300 hover:bg-gray-800">
                <History className="w-3.5 h-3.5" /> Edit Payments
              </Button>
            </>
          )}
          {linkedEstimates.length > 0 && (
            <Button onClick={() => navigate(`/EstimateDetail/${linkedEstimates[0].id}`)} className="bg-sky-500 hover:bg-sky-600 gap-2">
              <FileText className="w-4 h-4" /> View Estimate
            </Button>
          )}
        </div>
      </div>

      {/* Completed but no invoice — prominent prompt */}
      {(order.status === "completed" || order.status === "delivered") && linkedInvoicesList.length === 0 && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-300 font-semibold text-sm">This repair order is {order.status}!</p>
              <p className="text-gray-400 text-xs mt-0.5">Ready to invoice — all labor and parts will be pre-filled.</p>
            </div>
          </div>
          <Button onClick={() => setShowInvoiceDialog(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2 flex-shrink-0">
            <FileText className="w-4 h-4" /> Create Invoice
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
        <div className="flex items-start justify-between mb-6">
           <div>
             <h1 className="text-3xl font-bold text-white">Repair Order #{order.order_number}</h1>
             <button onClick={() => order.customer_id && navigate(`/CustomerDetails?id=${order.customer_id}`)} className="text-sky-400 hover:text-sky-300 hover:underline mt-1 text-left transition-colors font-medium">{order.customer_name}</button>
             {customer?.phone && <p className="text-sky-400 text-sm mt-1">{formatPhone(customer.phone)}</p>}
           </div>
           <Select value={order.status} onValueChange={(newStatus) => {
             setUpdatingStatus(true);
             base44.entities.RepairOrder.update(orderId, { status: newStatus });
             queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
             setUpdatingStatus(false);
           }} disabled={updatingStatus}>
             <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-gray-800 border-gray-700">
               <SelectItem value="waiting">Waiting</SelectItem>
               <SelectItem value="in_progress">In Progress</SelectItem>
               <SelectItem value="waiting_for_parts">Waiting for Parts</SelectItem>
               <SelectItem value="completed">Completed</SelectItem>
               <SelectItem value="delivered">Delivered</SelectItem>
             </SelectContent>
           </Select>
         </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
             <button
               onClick={() => order.vehicle_id && navigate(`/VehicleTimeline/${order.vehicle_id}`)}
               className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer transition-colors font-semibold text-left"
             >{order.vehicle_info || "—"}</button>
             {vehicleRecord?.license_plate && (
               <p className="text-gray-400 text-xs mt-1 font-mono tracking-wide">🪪 {vehicleRecord.license_plate.toUpperCase()}</p>
             )}
             {vehicleRecord?.vin && (
               <p className="text-gray-500 text-xs mt-0.5 font-mono">VIN: {vehicleRecord.vin.toUpperCase()}</p>
             )}
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Mechanic</p>
            <p className="text-white">{order.mechanic_name || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
            <p className="text-white capitalize">{order.status?.replace("_", " ")}</p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6">
          <h2 className="text-lg font-bold text-white mb-4">Description</h2>
          <p className="text-gray-300">{order.description}</p>
        </div>

        {/* Linked Estimates & Invoices */}
        {(linkedEstimates.length > 0 || linkedInvoicesList.length > 0) && (
          <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {linkedEstimates.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs uppercase mb-2">Linked Estimates</p>
                <div className="space-y-2">
                  {linkedEstimates.map(est => (
                    <div
                      key={est.id}
                      className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-green-500/20 transition-colors"
                      onClick={() => navigate(`/EstimateDetail/${est.id}`)}
                    >
                      <div>
                        <p className="text-green-400 font-medium text-sm">#{est.estimate_number}</p>
                        <p className="text-gray-400 text-xs">{est.vehicle_info}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        est.status === "approved" ? "bg-green-500/20 text-green-400" :
                        est.status === "declined" ? "bg-rose-500/20 text-rose-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>{est.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {linkedInvoicesList.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs uppercase mb-2">Linked Invoices</p>
                <div className="space-y-2">
                  {linkedInvoicesList.map(inv => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-purple-500/20 transition-colors"
                      onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
                    >
                      <div>
                        <p className="text-purple-400 font-medium text-sm">#{inv.invoice_number}</p>
                        <p className="text-gray-400 text-xs">{inv.vehicle_info}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        inv.status === "paid" ? "bg-green-500/20 text-green-400" :
                        inv.status === "partial" ? "bg-yellow-500/20 text-yellow-400" :
                        inv.status === "overdue" ? "bg-rose-500/20 text-rose-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>{inv.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-800">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Labor Hours</p>
            <p className="text-white text-lg font-semibold">{order.labor_hours || 0}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Labor Cost</p>
            <p className="text-white text-lg font-semibold">${order.labor_cost?.toFixed(2) || "0.00"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Parts Cost</p>
            <p className="text-white text-lg font-semibold">${order.parts_cost?.toFixed(2) || "0.00"}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800">
          <p className="text-gray-500 text-xs uppercase mb-2">Total Cost</p>
          <p className="text-white text-3xl font-bold">${order.total_cost?.toFixed(2) || "0.00"}</p>
        </div>

        {order.parts_used && order.parts_used.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Parts Used</h3>
              <button onClick={() => setShowPartDialog(true)} className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add Part
              </button>
            </div>
            <div className="space-y-3">
              {order.parts_used.map((part, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{part.name}</p>
                    <p className="text-gray-400 text-sm">Qty: {part.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">${part.total?.toFixed(2)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-gray-600 hover:text-gray-400 transition-colors p-1">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
                        <DropdownMenuItem onClick={() => setShowPartDialog(true)} className="cursor-pointer hover:bg-gray-700">
                          <Plus className="w-4 h-4 mr-2" /> Add Part
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removePart(idx)} className="cursor-pointer hover:bg-gray-700 text-rose-400">
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) || (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <button onClick={() => setShowPartDialog(true)} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" /> Add First Part
            </button>
          </div>
        )}

        {/* Parts Ordered Section */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-400" /> Parts Ordered
            </h3>
            <button onClick={() => setShowOrderedPartDialog(true)} className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Ordered Part
            </button>
          </div>
          {order.parts_ordered && order.parts_ordered.length > 0 ? (
            <div className="space-y-3">
              {order.parts_ordered.map((part, idx) => (
                <div key={idx} className="flex justify-between items-start bg-gray-800/30 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{part.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        part.status === "received" ? "bg-green-500/20 text-green-400" :
                        part.status === "cancelled" ? "bg-rose-500/20 text-rose-400" :
                        "bg-amber-500/20 text-amber-400"
                      }`}>{part.status || "ordered"}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {part.part_number && <p className="text-gray-500 text-xs">PN: {part.part_number}</p>}
                      {part.supplier && <p className="text-gray-500 text-xs">Supplier: {part.supplier}</p>}
                      <p className="text-gray-400 text-sm">Qty: {part.quantity}</p>
                    </div>
                    {part.notes && <p className="text-gray-500 text-xs mt-1 italic">{part.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {part.unit_price > 0 && <p className="text-white font-semibold">${((part.quantity || 1) * part.unit_price).toFixed(2)}</p>}
                    <select
                      value={part.status || "ordered"}
                      onChange={e => updateOrderedPartStatus(idx, e.target.value)}
                      className="text-xs bg-gray-700 border border-gray-600 text-white rounded px-1.5 py-1"
                    >
                      <option value="ordered">Ordered</option>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button onClick={() => removeOrderedPart(idx)} className="text-gray-600 hover:text-rose-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => setShowOrderedPartDialog(true)} className="text-amber-400 hover:text-amber-300 flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" /> Add First Ordered Part
            </button>
          )}
        </div>

        {/* Labor Section */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-sky-400" /> Labor
            </h3>
            <button onClick={() => setShowLaborDialog(true)} className="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Labor
            </button>
          </div>
          {order.labor_items && order.labor_items.length > 0 ? (
            <div className="space-y-3">
              {order.labor_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800/30 rounded-lg p-3">
                  <div>
                    <p className="text-white font-medium">{item.description}</p>
                    <p className="text-gray-400 text-sm">{item.hours}h @ ${item.rate}/hr</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold">${(item.hours * item.rate).toFixed(2)}</p>
                    <button onClick={() => removeLabor(idx)} className="text-gray-600 hover:text-rose-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => setShowLaborDialog(true)} className="text-sky-400 hover:text-sky-300 flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" /> Add First Labor Entry
            </button>
          )}
        </div>

        {order.notes && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <h3 className="text-lg font-bold text-white mb-3">Notes</h3>
            <p className="text-gray-300">{order.notes}</p>
          </div>
        )}

        {/* Customer Signature Section */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <PenLine className="w-5 h-5 text-purple-400" /> Customer Sign-off
            </h3>
            {!order.customer_signature && (
              <button onClick={() => setShowSignatureDialog(true)} className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1">
                <PenLine className="w-4 h-4" /> Request Signature
              </button>
            )}
          </div>
          {order.customer_signature ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium text-sm">Signed by {order.customer_signature_name || "Customer"}</p>
                  {order.customer_signature_date && (
                    <p className="text-gray-500 text-xs">{new Date(order.customer_signature_date).toLocaleString()}</p>
                  )}
                </div>
                <button onClick={() => setShowSignatureDialog(true)} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">Re-sign</button>
              </div>
              <img
                src={order.customer_signature}
                alt="Customer signature"
                className="max-h-20 rounded-lg bg-gray-800 p-2"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/20 p-6 flex flex-col items-center gap-3 text-center">
              <XCircle className="w-8 h-8 text-gray-600" />
              <p className="text-gray-500 text-sm">No signature captured yet</p>
              <button
                onClick={() => setShowSignatureDialog(true)}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium flex items-center gap-2"
              >
                <PenLine className="w-4 h-4" /> Capture Signature
              </button>
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Created: {new Date(order.created_date).toLocaleString()}</span>
          {order.updated_date && order.updated_date !== order.created_date && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated: {new Date(order.updated_date).toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Previous Work on This Vehicle */}
      {previousOrders.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-amber-400">Previous Work on This Vehicle</h2>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">{previousOrders.length} record{previousOrders.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {previousOrders.map(prev => (
              <div key={prev.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-900/60 rounded-lg p-4 border border-amber-500/10 hover:border-amber-500/30 transition-colors cursor-pointer" onClick={() => navigate(`/RepairOrderDetail/${prev.id}`)}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">#{prev.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      prev.status === "completed" || prev.status === "delivered" ? "bg-green-500/20 text-green-400" :
                      prev.status === "in_progress" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{prev.status?.replace("_", " ")}</span>
                  </div>
                  <p className="text-gray-400 text-sm mt-0.5 truncate">{prev.description}</p>
                  {prev.mechanic_name && <p className="text-gray-600 text-xs mt-0.5">Mechanic: {prev.mechanic_name}</p>}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right">
                  {prev.total_cost > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-emerald-400 font-semibold">${prev.total_cost.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="text-gray-300 text-xs">{new Date(prev.created_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <EstimateFormDialog
        open={showEstimateDialog}
        onClose={() => setShowEstimateDialog(false)}
        estimate={null}
        customers={customers}
        vehicles={vehicles}
        repairOrderId={orderId}
        onSaved={() => {
          setShowEstimateDialog(false);
          queryClient.invalidateQueries({ queryKey: ["estimates", "byRO", orderId] });
          navigate("/Estimates");
        }}
      />

      <InvoiceFormDialog
        open={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        invoice={null}
        orders={order ? [order] : []}
        customers={customers}
        initialOrderId={orderId}
        onSaved={() => {
          setShowInvoiceDialog(false);
          queryClient.invalidateQueries({ queryKey: ["invoices", "byRO", orderId] });
        }}
      />

      {/* Payment History Manager — edits payments on the linked invoice */}
      {showHistoryManager && linkedInvoicesList[0] && (
        <PaymentHistoryManager
          open={showHistoryManager}
          onClose={() => setShowHistoryManager(false)}
          invoice={linkedInvoicesList[0]}
          onSaved={() => {
            setShowHistoryManager(false);
            queryClient.invalidateQueries({ queryKey: ["invoices", "byRO", orderId] });
          }}
        />
      )}

      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-purple-400" /> Customer Signature
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm -mt-1">
            Have the customer sign below to approve the repair / estimate for <span className="text-white font-medium">{order.vehicle_info}</span>.
          </p>
          <SignaturePad
            existingSignature={order.customer_signature}
            signerName={order.customer_signature_name || order.customer_name}
            onCancel={() => setShowSignatureDialog(false)}
            onSave={({ signatureDataUrl, signerName, signedAt }) => {
              base44.entities.RepairOrder.update(orderId, {
                customer_signature: signatureDataUrl,
                customer_signature_name: signerName,
                customer_signature_date: signedAt,
              });
              queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
              setShowSignatureDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showLaborDialog} onOpenChange={setShowLaborDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Labor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Description</Label>
              <Input value={newLabor.description} onChange={e => setNewLabor({...newLabor, description: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. Oil change, Brake replacement" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Hours</Label>
                <Input type="number" step="0.5" value={newLabor.hours} onChange={e => setNewLabor({...newLabor, hours: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-gray-400">Rate ($/hr)</Label>
                <Input type="number" value={newLabor.rate} onChange={e => setNewLabor({...newLabor, rate: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0.00" />
              </div>
            </div>
            {newLabor.hours && newLabor.rate && (
              <p className="text-sky-400 text-sm font-medium">Total: ${(parseFloat(newLabor.hours) * parseFloat(newLabor.rate)).toFixed(2)}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowLaborDialog(false)} className="flex-1 px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button onClick={addLabor} className="flex-1 px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium">Add Labor</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showOrderedPartDialog} onOpenChange={setShowOrderedPartDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-amber-400" /> Add Ordered Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-gray-400">Part Name</Label>
                <Input value={newOrderedPart.name} onChange={e => setNewOrderedPart({...newOrderedPart, name: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. Brake Pad Set" />
              </div>
              <div>
                <Label className="text-gray-400">Part Number</Label>
                <Input value={newOrderedPart.part_number} onChange={e => setNewOrderedPart({...newOrderedPart, part_number: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. BP-12345" />
              </div>
              <div>
                <Label className="text-gray-400">Supplier</Label>
                <Input value={newOrderedPart.supplier} onChange={e => setNewOrderedPart({...newOrderedPart, supplier: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. AutoZone" />
              </div>
              <div>
                <Label className="text-gray-400">Quantity</Label>
                <Input type="number" value={newOrderedPart.quantity} onChange={e => setNewOrderedPart({...newOrderedPart, quantity: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="1" />
              </div>
              <div>
                <Label className="text-gray-400">Unit Price (optional)</Label>
                <Input type="number" value={newOrderedPart.unit_price} onChange={e => setNewOrderedPart({...newOrderedPart, unit_price: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <Label className="text-gray-400">Notes (optional)</Label>
                <Input value={newOrderedPart.notes} onChange={e => setNewOrderedPart({...newOrderedPart, notes: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. ETA 2 days" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowOrderedPartDialog(false)} className="flex-1 px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button onClick={addOrderedPart} className="flex-1 px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium">Add Part</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartDialog} onOpenChange={setShowPartDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400">Part Name</Label>
              <Input value={newPart.name} onChange={e => setNewPart({...newPart, name: e.target.value})} 
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. Oil Filter" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Quantity</Label>
                <Input type="number" value={newPart.quantity} onChange={e => setNewPart({...newPart, quantity: e.target.value})} 
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-gray-400">Unit Price</Label>
                <Input type="number" value={newPart.unit_price} onChange={e => setNewPart({...newPart, unit_price: e.target.value})} 
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="0.00" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPartDialog(false)} className="flex-1 px-4 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</button>
              <button onClick={addPart} className="flex-1 px-4 py-2 rounded bg-sky-500 hover:bg-sky-600 text-white font-medium">Add Part</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AutoAIBubble />
    </div>
  );

  async function syncLinkedInvoices(updatedParts, updatedLaborItems) {
    try {
      const linkedInvoices = await base44.entities.Invoice.filter({ repair_order_id: orderId });
      const partsTotal = updatedParts.reduce((s, p) => s + (p.total || 0), 0);
      const laborTotal = updatedLaborItems.reduce((s, l) => s + ((l.hours || 0) * (l.rate || 0)), 0);
      const newTotal = partsTotal + laborTotal;
      for (const inv of linkedInvoices) {
        const balanceDue = newTotal - (inv.amount_paid || 0);
        await base44.entities.Invoice.update(inv.id, {
          parts_total: partsTotal,
          labor_total: laborTotal,
          total: newTotal,
          balance_due: balanceDue > 0 ? balanceDue : 0,
          parts_used: updatedParts,
          line_items: [
            ...updatedParts.filter(p => p.name).map(p => ({ description: p.name, type: "part", quantity: p.quantity, unit_price: p.unit_price, total: p.total })),
            ...updatedLaborItems.filter(l => l.description).map(l => ({ description: l.description, type: "labor", quantity: l.hours, unit_price: l.rate, total: l.hours * l.rate })),
          ],
          customer_note: inv.customer_note,
        });
      }
    } catch (e) { console.warn("Sync to invoice failed:", e); }
  }

  function addPart() {
    if (!newPart.name || !newPart.quantity || !newPart.unit_price) return;
    const qty = parseFloat(newPart.quantity) || 0;
    const price = parseFloat(newPart.unit_price) || 0;
    const part = { name: newPart.name, quantity: qty, unit_price: price, total: qty * price };
    const updatedParts = [...(order.parts_used || []), part];
    const currentLabor = order.labor_items || [];
    base44.entities.RepairOrder.update(orderId, { parts_used: updatedParts });
    setNewPart({ name: "", quantity: "", unit_price: "" });
    setShowPartDialog(false);
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
    base44.functions.invoke('updateRepairOrderTotals', { orderId });
    syncLinkedInvoices(updatedParts, currentLabor);
  }

  function removePart(idx) {
    const updatedParts = order.parts_used.filter((_, i) => i !== idx);
    const currentLabor = order.labor_items || [];
    base44.entities.RepairOrder.update(orderId, { parts_used: updatedParts });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
    syncLinkedInvoices(updatedParts, currentLabor);
  }

  function addLabor() {
    if (!newLabor.description || !newLabor.hours || !newLabor.rate) return;
    const hours = parseFloat(newLabor.hours) || 0;
    const rate = parseFloat(newLabor.rate) || 0;
    const item = { description: newLabor.description, hours, rate, total: hours * rate };
    const updatedItems = [...(order.labor_items || []), item];
    const currentParts = order.parts_used || [];
    base44.entities.RepairOrder.update(orderId, { labor_items: updatedItems });
    setNewLabor({ description: "", hours: "", rate: "" });
    setShowLaborDialog(false);
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
    base44.functions.invoke('updateRepairOrderTotals', { orderId });
    syncLinkedInvoices(currentParts, updatedItems);
  }

  function addOrderedPart() {
    if (!newOrderedPart.name || !newOrderedPart.quantity) return;
    const part = {
      name: newOrderedPart.name,
      part_number: newOrderedPart.part_number,
      supplier: newOrderedPart.supplier,
      quantity: parseFloat(newOrderedPart.quantity) || 1,
      unit_price: parseFloat(newOrderedPart.unit_price) || 0,
      status: "ordered",
      order_date: new Date().toISOString().split("T")[0],
      notes: newOrderedPart.notes,
    };
    const updated = [...(order.parts_ordered || []), part];
    base44.entities.RepairOrder.update(orderId, { parts_ordered: updated });
    setNewOrderedPart({ name: "", part_number: "", supplier: "", quantity: "", unit_price: "", notes: "" });
    setShowOrderedPartDialog(false);
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }

  function removeOrderedPart(idx) {
    const updated = order.parts_ordered.filter((_, i) => i !== idx);
    base44.entities.RepairOrder.update(orderId, { parts_ordered: updated });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }

  function updateOrderedPartStatus(idx, status) {
    const updated = order.parts_ordered.map((p, i) => i === idx ? { ...p, status } : p);
    base44.entities.RepairOrder.update(orderId, { parts_ordered: updated });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
  }

  function removeLabor(idx) {
    const updatedItems = order.labor_items.filter((_, i) => i !== idx);
    const newLaborCost = updatedItems.reduce((sum, i) => sum + i.hours * i.rate, 0);
    const newTotal = newLaborCost + (order.parts_cost || 0);
    const currentParts = order.parts_used || [];
    base44.entities.RepairOrder.update(orderId, {
      labor_items: updatedItems,
      labor_hours: updatedItems.reduce((sum, i) => sum + i.hours, 0),
      labor_cost: newLaborCost,
      total_cost: newTotal,
    });
    queryClient.invalidateQueries({ queryKey: ["repairOrder", orderId] });
    syncLinkedInvoices(currentParts, updatedItems);
  }
}