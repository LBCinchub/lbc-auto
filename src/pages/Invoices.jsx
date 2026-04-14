import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Trash2, Printer, Download, DollarSign, MessageSquare, ShieldCheck, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { jsPDF } from "jspdf";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";
import InvoicePrintView from "../components/invoices/InvoicePrintView";
import PaymentReceiptDialog from "../components/invoices/PaymentReceiptDialog";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [sendingAuth, setSendingAuth] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Auto-open new invoice dialog if coming from customer profile
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get("customerId");
    const customerName = urlParams.get("customerName");
    if (customerId) {
      setEditingInvoice({ customer_id: customerId, customer_name: customerName });
      setDialogOpen(true);
    }
  }, []);

  const sendAuthSMS = async (inv) => {
    const customer = customers.find(c => c.id === inv.customer_id);
    const phone = customer?.phone;
    if (!phone) { alert("No phone number found for this customer. Please add a phone number to the customer profile first."); return; }
    setSendingAuth(inv.id);
    try {
      const appUrl = window.location.origin;
      await base44.functions.invoke('sendInvoiceAuthSMS', { invoice_id: inv.id, phone, app_url: appUrl });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      alert(`Authorization SMS sent to ${phone}`);
    } catch (err) {
      const detail = err?.response?.data?.details?.message || err?.response?.data?.error || err.message;
      alert(`Failed to send SMS: ${detail}`);
    } finally {
      setSendingAuth(null);
    }
  };

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.email],
    queryFn: () => user ? base44.entities.Invoice.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 200) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 500) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = invoices
    .filter(i => statusFilter === "all" || i.status === statusFilter || (statusFilter === "unpaid" && i.status === "partial"))
    .filter(i => {
      if (!search) return true;
      const q = search.toLowerCase();
      if (i.invoice_number?.toLowerCase().includes(q)) return true;
      if (i.customer_name?.toLowerCase().includes(q)) return true;
      if (i.vehicle_info?.toLowerCase().includes(q)) return true;
      const customer = customers.find(c => c.id === i.customer_id);
      if (customer?.phone?.toLowerCase().includes(q)) return true;
      const vehicle = vehicles.find(v => i.vehicle_info?.includes(v.make) && v.customer_id === i.customer_id);
      if (vehicle?.license_plate?.toLowerCase().includes(q)) return true;
      if (vehicle?.vin?.toLowerCase().includes(q)) return true;
      return false;
    });

  const handleDelete = async (id) => {
    if (window.confirm("Delete this invoice?")) {
      await base44.entities.Invoice.delete(id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const markPaid = async (inv) => {
    await base44.entities.Invoice.update(inv.id, {
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const downloadPDF = (inv) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(14, 165, 233);
    doc.text("LBC AUTO", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Professional Auto Repair Services", 20, 27);
    
    // Invoice Title
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text("INVOICE", 150, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`#${inv.invoice_number}`, 150, 27);
    doc.text(`Date: ${new Date(inv.created_date).toLocaleDateString()}`, 150, 33);
    
    // Customer Info
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("BILL TO:", 20, 50);
    doc.setFontSize(10);
    doc.text(inv.customer_name, 20, 57);
    doc.text(inv.vehicle_info, 20, 63);
    
    // Line Items Table
    let y = 85;
    doc.setFillColor(14, 165, 233);
    doc.rect(20, y, 170, 8, 'F');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text("Description", 25, y + 5.5);
    doc.text("Qty", 120, y + 5.5);
    doc.text("Price", 145, y + 5.5);
    doc.text("Total", 170, y + 5.5);
    
    y += 12;
    doc.setTextColor(0);
    
    if (inv.line_items && inv.line_items.length > 0) {
      inv.line_items.forEach(item => {
        doc.text(item.description || '', 25, y);
        doc.text(String(item.quantity || 1), 120, y);
        doc.text(`$${(item.unit_price || 0).toFixed(2)}`, 145, y);
        doc.text(`$${(item.total || 0).toFixed(2)}`, 170, y);
        y += 8;
      });
    }
    
    // Totals
    y += 10;
    doc.text("Subtotal (Parts):", 120, y);
    doc.text(`$${(inv.parts_total || 0).toFixed(2)}`, 170, y);
    
    y += 7;
    doc.text("Subtotal (Labor):", 120, y);
    doc.text(`$${(inv.labor_total || 0).toFixed(2)}`, 170, y);
    
    y += 7;
    doc.text(`Tax (${inv.tax_rate || 0}%):`, 120, y);
    doc.text(`$${(inv.tax_amount || 0).toFixed(2)}`, 170, y);
    
    y += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL:", 120, y);
    doc.text(`$${(inv.total || 0).toFixed(2)}`, 170, y);
    
    // Payment Status
    y += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const statusColor = inv.status === 'paid' ? [34, 197, 94] : [251, 191, 36];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${inv.status.toUpperCase()}`, 20, y);
    
    if (inv.paid_date) {
      doc.setTextColor(100);
      doc.text(`Paid on: ${new Date(inv.paid_date).toLocaleDateString()}`, 20, y + 7);
    }
    
    // Footer
    doc.setTextColor(150);
    doc.setFontSize(9);
    doc.text("Thank you for your business!", 105, 280, { align: 'center' });
    
    doc.save(`Invoice-${inv.invoice_number}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle={`${invoices.length} total invoices`}
        onAdd={() => { setEditingInvoice(null); setDialogOpen(true); }} addLabel="Create Invoice" />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice # or customer..." />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-gray-800/50">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">All</TabsTrigger>
            <TabsTrigger value="unpaid" className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Unpaid</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Paid</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Create your first invoice."
          onAction={() => { setEditingInvoice(null); setDialogOpen(true); }} actionLabel="Create Invoice" />
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <div key={inv.id}
              className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors cursor-pointer"
              onClick={() => setPrintInvoice(inv)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{inv.invoice_number}</h3>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {inv.customer_name} · {inv.vehicle_info}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {inv.due_date && (
                      <span className={`text-xs flex items-center gap-1 ${
                        inv.status !== "paid" && inv.due_date < new Date().toISOString().split("T")[0]
                          ? "text-rose-400 font-medium"
                          : "text-gray-500"
                      }`}>
                        {inv.status !== "paid" && inv.due_date < new Date().toISOString().split("T")[0]
                          ? <AlertCircle className="w-3 h-3" />
                          : <Calendar className="w-3 h-3" />}
                        Due {new Date(inv.due_date + "T00:00:00").toLocaleDateString()}
                      </span>
                    )}
                    {inv.paid_date && inv.status === "paid" && (
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Paid {new Date(inv.paid_date + "T00:00:00").toLocaleDateString()}
                      </span>
                    )}
                    {inv.estimate_id && (
                      <span className="text-xs text-sky-500/70">From Estimate</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-base font-bold text-white">${(inv.total || 0).toFixed(2)}</p>
                  </div>
                  {(inv.amount_paid > 0) && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="text-base font-semibold text-emerald-400">${(inv.amount_paid || 0).toFixed(2)}</p>
                    </div>
                  )}
                  {(inv.status === 'partial' || inv.status === 'unpaid') && inv.balance_due > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className="text-base font-bold text-yellow-400">${(inv.balance_due || 0).toFixed(2)}</p>
                    </div>
                  )}
                  {inv.status === 'paid' && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Balance</p>
                      <p className="text-base font-bold text-emerald-400">$0.00</p>
                    </div>
                  )}
                  <div className="flex gap-1">
                    {(inv.status === "unpaid" || inv.status === "partial") && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
                        onClick={() => setPaymentInvoice(inv)} title="Record Payment">
                        <DollarSign className="w-4 h-4" />
                      </Button>
                    )}
                    {inv.auth_status === "approved" ? (
                      <span title="Approved by customer" className="flex items-center justify-center h-8 w-8">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </span>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-500 hover:text-sky-400"
                        onClick={() => sendAuthSMS(inv)} disabled={sendingAuth === inv.id} title="Send Auth SMS">
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => downloadPDF(inv)} title="Download PDF">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => setPrintInvoice(inv)} title="Print">
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white"
                      onClick={() => { setEditingInvoice(inv); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                      onClick={() => handleDelete(inv.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <InvoiceFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        invoice={editingInvoice}
        orders={orders}
        customers={customers}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
      />

      {printInvoice && (
        <InvoicePrintView invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      )}

      <PaymentReceiptDialog
        open={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
      />
    </div>
  );
}