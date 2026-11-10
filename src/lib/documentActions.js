// Shared staff document actions. Moved verbatim from the Invoices, Estimates and
// Repair Orders pages so the main lists and the customer profile run the exact same
// handlers. Authorization, tenant scope, Pro entitlement and conversion rules stay
// enforced by the existing server functions and entity rules.
import { base44 } from "@/api/base44Client";
import { jsPDF } from "jspdf";
import { TAX_RATE } from "@/lib/constants";

export const errorText = (err) =>
  err?.response?.data?.details?.message || err?.response?.data?.error || err?.message || String(err);

// Request Signature (Link): texts a signing link (never the PDF). Confirms first.
export async function requestInvoiceSignature(inv, phone) {
  if (!phone) { alert("No phone number found for this customer. Please add a phone number to the customer profile first."); return false; }
  if (!window.confirm(`Request Signature (Link)\n\nThis texts ${phone} a signing LINK, not the invoice PDF. To send the PDF itself, use "Text Invoice PDF".\n\nSend the signature link?`)) return false;
  try {
    await base44.functions.invoke("sendInvoiceAuthSMS", { invoice_id: inv.id, phone, app_url: window.location.origin });
    alert(`Signature link sent to ${phone}`);
    return true;
  } catch (err) {
    alert(`Failed to send SMS: ${errorText(err)}`);
    return false;
  }
}

const ENTITY_LABELS = { Invoice: "invoice", Estimate: "estimate", RepairOrder: "repair order" };

// Explicit confirmation, then the same entity delete the main pages use (RLS-enforced).
export async function deleteDocument(entityName, id) {
  if (!window.confirm(`Delete this ${ENTITY_LABELS[entityName]}?`)) return false;
  await base44.entities[entityName].delete(id);
  return true;
}

export async function approveEstimate(est) {
  if (est.status === "approved") return false;
  try {
    await base44.entities.Estimate.update(est.id, { status: "approved" });
    return true;
  } catch (err) {
    console.error("Error approving estimate:", err);
    return false;
  }
}

// Server enforces the approval policy and returns the existing RO when already converted.
export async function convertEstimateToRepairOrder(est) {
  if (!window.confirm(`Convert estimate ${est.estimate_number || ""} to a repair order?`)) return null;
  try {
    const response = await base44.functions.invoke("convertEstimateToRepairOrder", { estimate_id: est.id });
    return response.data?.repair_order || null;
  } catch (err) {
    window.alert(`Could not convert to a repair order: ${errorText(err)}`);
    return null;
  }
}

// Idempotent server action: a repeat returns the same invoice instead of a duplicate.
export async function generateInvoiceFromRepairOrder(order) {
  if (!window.confirm(`Generate an invoice from repair order ${order.order_number || ""}?`)) return null;
  try {
    const response = await base44.functions.invoke("financialDocumentAction", { action: "create", source_type: "repair_order", source_id: order.id, idempotency_key: `repair-order-invoice:${order.id}` });
    return response.data?.invoice || null;
  } catch (err) {
    alert("Could not generate invoice: " + errorText(err));
    return null;
  }
}

// Email an estimate; only a confirmed send marks it sent.
export async function emailEstimate(sendEmail, est, cachedEmail) {
  const sent = await sendEmail(est.id, "estimate", cachedEmail, est.customer_id, est.customer_name, est);
  if (sent) await base44.entities.Estimate.update(est.id, { status: "sent", auth_status: "pending" });
  return sent;
}

export function estimateCashoutSource(est) {
  return {
    id: est.id,
    customer_id: est.customer_id || "",
    customer_name: est.customer_name,
    vehicle_info: est.vehicle_info,
    total: est.grand_total || 0,
    labor_total: est.labor_total || 0,
    parts_total: est.parts_total || 0,
    labor_items: est.labor_items || [],
    parts_items: est.parts_items || [],
    tax_rate: est.tax_rate || 0,
    tax_applies_to: est.tax_applies_to || "both",
    tax_amount: est.tax_amount || 0,
    discount: est.discount || 0,
    discount_type: est.discount_type || "$",
    service_reason: est.service_reason || "",
    notes: est.notes || "",
    amount_paid: est.amount_paid || 0,
    balance_due: (est.grand_total || 0) - (est.amount_paid || 0),
    payment_history: est.payment_history || [],
    linked_invoice_id: est.linked_invoice_id || null,
    linked_invoice_number: est.linked_invoice_number || null,
    _source: "estimate",
  };
}

export function repairOrderCashoutSource(order) {
  return {
    id: order.id,
    customer_id: order.customer_id || "",
    customer_name: order.customer_name,
    vehicle_id: order.vehicle_id || "",
    vehicle_info: order.vehicle_info,
    total: order.total_cost || 0,
    labor_cost: order.labor_cost || 0,
    parts_cost: order.parts_cost || 0,
    tax_amount: order.tax_amount || 0,
    amount_paid: order.amount_paid || 0,
    balance_due: (order.total_cost || 0) - (order.amount_paid || 0),
    payment_history: order.payment_history || [],
    linked_invoice_id: order.linked_invoice_id || null,
    linked_invoice_number: order.linked_invoice_number || null,
  };
}

export function downloadInvoicePdf(inv) {
  const doc = new jsPDF();
  doc.setFontSize(24);
  doc.setTextColor(14, 165, 233);
  doc.text("LBC AUTO", 20, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Professional Auto Repair Services", 20, 27);
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text("INVOICE", 150, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`#${inv.invoice_number}`, 150, 27);
  doc.text(`Date: ${new Date(inv.created_date).toLocaleDateString()}`, 150, 33);
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text("BILL TO:", 20, 50);
  doc.setFontSize(10);
  doc.text(inv.customer_name, 20, 57);
  doc.text(inv.vehicle_info, 20, 63);
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
  doc.setTextColor(150);
  doc.setFontSize(9);
  doc.text("Thank you for your business!", 105, 280, { align: 'center' });
  doc.save(`Invoice-${inv.invoice_number}.pdf`);
}

export { invoiceActionState, estimateActionState, repairOrderActionState } from "./documentActionState.js";