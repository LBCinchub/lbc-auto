import React from "react";
import { CalendarDays, ChevronRight, ClipboardList, FileCheck2, Receipt } from "lucide-react";
import { formatDate, formatMoney, statusLabel } from "@/components/customer-dashboard/portalUtils";

export default function DashboardWidgets({ data, onOpen }) {
  const newest = (rows) => [...rows].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const openOrders = newest(data.orders.filter((row) => !["completed", "delivered"].includes(row.status)));
  const openEstimates = newest(data.estimates.filter((row) => ["draft", "sent"].includes(row.status) || row.auth_status === "pending"));
  const dueInvoices = newest(data.invoices.filter((row) => Number(row.balance_due) > 0));
  const upcoming = data.appointments.filter((row) => !["completed", "cancelled"].includes(row.status) && new Date(row.date) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.date) - new Date(b.date));
  const widgets = [
    { id: "orders", label: "Repair Orders", icon: ClipboardList, count: openOrders.length, detail: openOrders[0] ? statusLabel(openOrders[0].status) : "No open repair orders", meta: openOrders[0] ? formatDate(openOrders[0].created_date) : "Your completed history is still available" },
    { id: "estimates", label: "Estimates", icon: FileCheck2, count: openEstimates.length, detail: openEstimates[0] ? statusLabel(openEstimates[0].status) : "No estimates awaiting action", meta: openEstimates[0] ? formatDate(openEstimates[0].created_date) : "Nothing needs your approval" },
    { id: "invoices", label: "Invoices", icon: Receipt, count: dueInvoices.length, detail: dueInvoices.length ? `${formatMoney(dueInvoices.reduce((sum, row) => sum + Number(row.balance_due || 0), 0))} due` : "No outstanding invoices", meta: dueInvoices[0]?.due_date ? `Due ${formatDate(dueInvoices[0].due_date)}` : "Your billing is up to date" },
    { id: "appointments", label: "Appointments", icon: CalendarDays, count: upcoming.length, detail: upcoming[0] ? statusLabel(upcoming[0].service_type) : "No upcoming appointments", meta: upcoming[0] ? `${formatDate(upcoming[0].date)}${upcoming[0].time_slot ? ` · ${upcoming[0].time_slot}` : ""}` : "Book when your vehicle needs care" },
  ];
  return <section><div className="portal-section-heading"><div><p className="portal-eyebrow">At a glance</p><h2>Service dashboard</h2></div></div><div className="portal-widget-grid">{widgets.map(({ id, label, icon: Icon, count, detail, meta }) => <button key={id} className="portal-widget" onClick={() => onOpen(id)}><div className="flex items-start justify-between"><div className="portal-icon-box"><Icon /></div><ChevronRight className="portal-chevron" /></div><div className="portal-widget-count">{count}</div><h3>{label}</h3><p>{detail}</p><small>{meta}</small></button>)}</div></section>;
}