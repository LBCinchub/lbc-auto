import React from "react";
import { Wrench, FileCheck2, ReceiptText, CalendarDays, ChevronRight } from "lucide-react";
import { formatDate, formatMoney, formatStatus } from "./dashboardUtils";

export default function SummaryWidgets({ orders, estimates, invoices, appointments, onOpen }) {
  const openOrders = orders.filter((r) => !["completed", "delivered"].includes(r.status));
  const pendingEstimates = estimates.filter((r) => !["approved", "declined", "invoiced", "cancelled", "expired"].includes(r.status));
  const openInvoices = invoices.filter((r) => r.status !== "paid");
  const upcoming = appointments.filter((r) => !["completed", "cancelled"].includes(r.status)).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const widgets = [
    { label:"Repair Orders", Icon:Wrench, rows:orders, open:openOrders, empty:"No open repair orders", detail:openOrders[0] && formatStatus(openOrders[0].status), date:openOrders[0]?.estimated_completion || openOrders[0]?.created_date },
    { label:"Estimates", Icon:FileCheck2, rows:estimates, open:pendingEstimates, empty:"No estimates awaiting action", detail:pendingEstimates[0] && formatStatus(pendingEstimates[0].status), date:pendingEstimates[0]?.valid_until || pendingEstimates[0]?.created_date },
    { label:"Invoices", Icon:ReceiptText, rows:invoices, open:openInvoices, empty:"No outstanding invoices", detail:openInvoices.length ? `${formatMoney(openInvoices.reduce((sum,r) => sum + Number(r.balance_due || 0), 0))} due` : "", date:openInvoices[0]?.due_date || openInvoices[0]?.created_date },
    { label:"Appointments", Icon:CalendarDays, rows:appointments, open:upcoming, empty:"No upcoming appointments", detail:upcoming[0]?.service_type, date:upcoming[0]?.date },
  ];
  return <section className="cd-section"><div className="cd-section-heading"><div><span>At a glance</span><h2>Your dashboard</h2></div></div><div className="cd-widget-grid">{widgets.map((w) => <button key={w.label} className="cd-widget" onClick={() => onOpen(w.label, w.open[0] || w.rows[0])}><span className="cd-widget-icon"><w.Icon /></span><ChevronRight className="cd-widget-chevron"/><strong>{w.label}</strong><b>{w.open.length ? w.open.length : "Up to date"}</b><span>{w.detail || w.empty}</span>{w.date && <small>{formatDate(w.date)}</small>}</button>)}</div></section>;
}