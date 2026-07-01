import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation} from 'react-router-dom';
import { FileText, Pencil, Trash2, Printer, Download, DollarSign, MessageSquare, ShieldCheck, Calendar, AlertCircle, Phone, Mail, Hash, Sheet, Send, Loader2, Wrench, ExternalLink, History } from "lucide-react";
import { useEmailSend } from "@/hooks/useEmailSend";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { TAX_RATE } from "@/lib/constants";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import { formatPhone } from "@/utils/formatPhone";
import PageHeader from "../components/shared/PageHeader";
import SearchBar from "../components/shared/SearchBar";
import EmptyState from "../components/shared/EmptyState";
import StatusBadge from "../components/shared/StatusBadge";
import InvoiceFormDialog from "../components/invoices/InvoiceFormDialog";
import InvoicePrintView from "../components/invoices/InvoicePrintView";
import PaymentReceiptDialog from "../components/invoices/PaymentReceiptDialog";
import PaymentHistoryManager from "../components/invoices/PaymentHistoryManager";
import DateFilter, { applyDateFilter } from "../components/shared/DateFilter";

const PAGE_SIZE = 20;

export default function Invoices() {
  const _location = useLocation();
  const _urlQ = new URLSearchParams(_location.search).get("q") || "";
  const [search, setSearch] = useState(_urlQ);
  // Sync search if URL param changes (e.g. navigating from GlobalSearch)
  React.useEffect(() => {
    const q = new URLSearchParams(_location.search).get("q") || "";
    if (q) setSearch(q);
  }, [_location.search]);
  const [searchField, setSearchField] = useState(() => new URLSearchParams(window.location.search).get("sf") || "all");
  const [statusFilter, setStatusFilter] = useState(() => new URLSearchParams(window.location.search).get("status") || "all");
  const [page, setPage] = useState(() => parseInt(new URLSearchParams(window.location.search).get("pg") || "1", 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printInvoice, setPrintInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [sendingAuth, setSendingAuth] = useState(null);
  const [creatingRO, setCreatingRO] = useState(null); // invoice id being sent to RO
  const [historyInvoice, setHistoryInvoice] = useState(null); // invoice open in history manager
  const [dateRange, setDateRange] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Auto-open new invoice dialog if coming from customer profile
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get("customerId");
    const customerName = urlParams.get("customerName");
    const vehicleId = urlParams.get("vehicleId");
    const vehicleInfo = urlParams.get("vehicleInfo");
    if (customerId) {
      setEditingInvoice({ customer_id: customerId, customer_name: customerName, vehicle_id: vehicleId || "", vehicle_info: vehicleInfo || "" });
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
    queryFn: () => user ? base44.entities.Invoice.filter({created_by: user.email}, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["repairOrders", user?.email],
    queryFn: () => user ? base44.entities.RepairOrder.filter({created_by: user.email}, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", user?.email],
    queryFn: () => user ? base44.entities.Customer.filter({created_by: user.email}, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", user?.email],
    queryFn: () => user ? base44.entities.Vehicle.filter({created_by: user.email}, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", user?.email],
    queryFn: () => user ? base44.entities.Estimate.filter({created_by: user.email}, "-created_date", 10000) : Promise.resolve([]),
    enabled: !!user,
  });

  const filtered = applyDateFilter(
    invoices
      .filter(i => statusFilter === "all" || i.status === statusFilter || (statusFilter === "unpaid" && i.status === "partial"))
      .filter(i => {
        if (searchField === "invoice_number") return fuzzyMatch(search, [i.invoice_number]);
        if (searchField === "customer") return fuzzyMatch(search, [i.customer_name]);
        if (searchField === "vehicle") return fuzzyMatch(search, [i.vehicle_info]);
        const customer = customers.find(c => c.id === i.customer_id);
        return fuzzyMatch(search, [i.invoice_number, i.customer_name, i.vehicle_info, customer?.phone, customer?.email]);
      }),
    dateRange,
    r => r.created_date
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, searchField, statusFilter, dateRange]);

  const handleDelete = async (id) => {
    if (window.confirm("Delete this invoice?")) {
      await base44.entities.Invoice.delete(id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const { sending: sendingEmail, sendEmail } = useEmailSend();

  const sendInvoiceEmail = (e, inv) => {
    e.stopPropagation();
    const cachedEmail = customers.find(c => c.id === inv.customer_id)?.email || null;
    sendEmail(inv.id, "invoice", cachedEmail, inv.customer_id, inv.customer_name, inv);
  };

  const markPaid = async (inv) => {
    await base44.entities.Invoice.update(inv.id, {
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  };

  const exportCSV = () => {
    const headers = ["Invoice #", "Date", "Customer", "Vehicle", "Status", "Parts", "Labor", "Tax", "Total", "Amount Paid", "Balance Due", "Due Date", "Paid Date", "Payment Method"];
    const rows = filtered.map(inv => [
      inv.invoice_number || "",
      new Date(inv.created_date).toLocaleDateString(),
      inv.customer_name || "",
      inv.vehicle_info || "",
      inv.status || "",
      (inv.parts_total || 0).toFixed(2),
      (inv.labor_total || 0).toFixed(2),
      (inv.tax_amount || 0).toFixed(2),
      (inv.total || 0).toFixed(2),
      (inv.amount_paid || 0).toFixed(2),
      (inv.balance_due || 0).toFixed(2),
      inv.due_date || "",
      inv.paid_date || "",
      inv.payment_method || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    doc.text(`Tax (${TAX_RATE}%):`, 120, y);
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


  // URL persistence — keeps filters in sync so Back/Forward restores layout
  const _pushParams = React.useCallback((updates) => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v || v === 'all' || v === 1) p.delete(k);
      else p.set(k, String(v));
    });
    const qs = p.toString();
    navigate({ search: qs ? '?' + qs : '' }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);
  React.useEffect(() => {
    const _p = new URLSearchParams(_location.search);
    const _q = _p.get('q') || '';
    setSearch(prev => prev !== _q ? _q : prev);
    const _sf = _p.get('sf') || 'all';
    setSearchField(prev => prev !== _sf ? _sf : prev);
    const _status = _p.get('status') || 'all';
    setStatusFilter(prev => prev !== _status ? _status : prev);
    const _pg = parseInt(_p.get('pg') || '1', 10);
    setPage(prev => prev !== _pg ? _pg : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_location.search]);

  // ── Send Invoice to Repair Order ──────────────────────────────────────────
  const handleSendToRO = async (e, inv) => {
    e.stopPropagation();
    if (inv.repair_order_id) {
      navigate(`/RepairOrderDetail/${inv.repair_order_id}`);
      return;
    }
    setCreatingRO(inv.id);
    try {
      const roData = {
        customer_id:       inv.customer_id || "",
        customer_name:     inv.customer_name || "",
        customer_phone:    inv.customer_phone || "",
        vehicle_id:        inv.vehicle_id || "",
        vehicle_info:      inv.vehicle_info || "",
        description:       inv.service_reason || "Service from Invoice #" + inv.invoice_number,
        labor_items:       inv.labor_items  || [],
        parts_used:        inv.parts_used   || [],
        labor_cost:        inv.labor_total  || 0,
        parts_cost:        inv.parts_total  || 0,
        total_cost:        inv.grand_total  || inv.total || 0,
        status:            "pending",
        linked_invoice_id: inv.id,
        order_number:      "RO-" + Date.now().toString(36).toUpperCase(),
      };
      const newRO = await base44.entities.RepairOrder.create(roData);
      await base44.entities.Invoice.update(inv.id, { repair_order_id: newRO.id });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate(`/RepairOrderDetail/${newRO.id}`);
    } catch(err) {
      alert("Could not create Repair Order: " + (err?.message || err));
    } finally {
      setCreatingRO(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader title="Invoices" subtitle={dateRange ? `${filtered.length} invoices found` : `${invoices.length} total invoices`}
          onAdd={() => { setEditingInvoice(null); setDialogOpen(true); }} addLabel="Create Invoice" />
        <Button variant="outline" size="sm" onClick={exportCSV} className="border-gray-700 text-gray-300 hover:text-white gap-2 flex-shrink-0">
          <Sheet className="w-4 h-4" /> Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex flex-1 gap-2 items-center">
          <Select value={searchField} onValueChange={(v) => { setSearchField(v); _pushParams({ sf: v }); }}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="invoice_number">Invoice #</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1">
            <SearchBar value={search} onChange={(v) => { setSearch(v); _pushParams({ q: v }); }} placeholder={
              searchField === "invoice_number" ? "Search by invoice #..." :
              searchField === "customer" ? "Search by customer..." :
              searchField === "vehicle" ? "Search by vehicle..." :
              "Search by invoice #, customer, or vehicle..."
            } />
          </div>
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); _pushParams({ status: v }); }}>
          <TabsList className="bg-gray-800/50">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-400">All</TabsTrigger>
            <TabsTrigger value="unpaid" className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">Unpaid</TabsTrigger>
            <TabsTrigger value="paid" className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">Paid</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400">Overdue</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DateFilter onChange={setDateRange} />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-800/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices found" description="Create your first invoice."
          onAction={() => { setEditingInvoice(null); setDialogOpen(true); }} actionLabel="Create Invoice" />
      ) : (
        <div className="space-y-3">
          {paginated.map(inv => (
            <div key={inv.id}
              className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5 hover:border-sky-500/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold">{inv.invoice_number}</h3>
                    <StatusBadge status={inv.status} />
                    {inv.status === "unpaid" && new Date(inv.created_date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">OVERDUE</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5">
                   <span className="text-blue-400 capitalize">{inv.customer_name}</span> · <span className="text-green-400 capitalize">{inv.vehicle_info}</span>
                  </p>
                  {(() => {
                    const customer = customers.find(c => c.id === inv.customer_id);
                    const vehicle = vehicles.find(v => v.id === inv.vehicle_id || (inv.repair_order_id && orders.find(o => o.id === inv.repair_order_id)?.vehicle_id === v.id));
                    return (
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        {customer?.phone && (
                          <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium">
                            <Phone className="w-3 h-3" />{formatPhone(customer.phone)}
                          </a>
                        )}
                        {customer?.email && (
                          <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium">
                            <Mail className="w-3 h-3" />{customer.email}
                          </a>
                        )}
                        {vehicle?.license_plate && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
                            <Hash className="w-3 h-3" />{vehicle.license_plate}
                          </span>
                        )}
                        {vehicle?.vin && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-mono">
                            VIN: {vehicle.vin}
                          </span>
                        )}
                      </div>
                    );
                  })()}
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
                    <span className="text-xs text-gray-600">
                      Created {new Date(inv.created_date).toLocaleString()}
                      {inv.updated_date && inv.updated_date !== inv.created_date && (
                        <> · Updated {new Date(inv.updated_date).toLocaleString()}</>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {inv.tax_amount > 0 && (
                    <div className="text-right border-r border-gray-700/50 pr-4">
                      <p className="text-xs text-gray-500">GST/HST ({inv.tax_rate ?? 0}%)</p>
                      <p className="text-sm font-semibold text-amber-400">${(inv.tax_amount || 0).toFixed(2)}</p>
                    </div>
                  )}
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
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400" title="Send Invoice to Customer" onClick={e => sendInvoiceEmail(e, inv)} disabled={sendingEmail === inv.id}>
                      {sendingEmail === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
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
                    {/* Send to / View Repair Order */}
                    <Button variant="ghost" size="icon"
                      className={`h-8 w-8 ${inv.repair_order_id ? "text-orange-400 hover:text-orange-300" : "text-gray-500 hover:text-orange-400"}`}
                      onClick={(e) => handleSendToRO(e, inv)}
                      title={inv.repair_order_id ? "View Repair Order" : "Send to Repair Order"}
                      disabled={creatingRO === inv.id}>
                      {creatingRO === inv.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Wrench className="w-3.5 h-3.5" />
                      }
                    </Button>
                    {/* Edit Payment History */}
                    {(inv.payment_history?.length > 0 || inv.amount_paid > 0) && (
                      <Button variant="ghost" size="icon"
                        className="h-8 w-8 text-yellow-500 hover:text-yellow-400"
                        title="Edit Payment History"
                        onClick={(e) => { e.stopPropagation(); setHistoryInvoice(inv); }}>
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Edit invoice */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-sky-400"
                      title="Edit Invoice"
                      onClick={(e) => { e.stopPropagation(); setEditingInvoice(inv); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {/* Open detail page */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-violet-400"
                      title="Open Invoice Detail"
                      onClick={(e) => { e.stopPropagation(); navigate(`/InvoiceDetail/${inv.id}`); }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-rose-400"
                      onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="border-gray-700 text-gray-300">Previous</Button>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="border-gray-700 text-gray-300">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment History Manager */}
      {historyInvoice && (
        <PaymentHistoryManager
          open={!!historyInvoice}
          onClose={() => setHistoryInvoice(null)}
          invoice={historyInvoice}
          onSaved={() => {
            setHistoryInvoice(null);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}

      <InvoiceFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        invoice={editingInvoice}
        orders={orders}
        customers={customers}
        vehicles={vehicles}
        invoices={invoices}
        estimates={estimates}
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