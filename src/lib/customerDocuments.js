// Shared helpers for opening a customer's financial documents in their canonical
// staff views (the same pages the Invoices, Estimates and Repair Orders modules open).

const DETAIL_PATHS = {
  invoice: "/InvoiceDetail/",
  estimate: "/EstimateDetail/",
  repair_order: "/RepairOrderDetail/",
};

// Only same-app relative paths are accepted as a return target.
export function safeReturnTo(value) {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

// True when the router has an earlier in-app entry to go back to.
export function hasInAppHistory() {
  return (window.history.state?.idx ?? 0) > 0;
}

export function documentPath(type, id) {
  const base = DETAIL_PATHS[type];
  return base && id ? base + encodeURIComponent(id) : null;
}

const PATH_TYPES = { InvoiceDetail: "invoice", EstimateDetail: "estimate", RepairOrderDetail: "repair_order" };

// "/InvoiceDetail/abc" -> { type: "invoice", id: "abc" }; anything else -> null.
export function matchDocumentPath(to) {
  const m = typeof to === "string" && to.match(/^\/(InvoiceDetail|EstimateDetail|RepairOrderDetail)\/([^/?#]+)$/);
  return m ? { type: PATH_TYPES[m[1]], id: decodeURIComponent(m[2]) } : null;
}

// Profile tab keys, matching the staff customer profile's tabs.
export const PROFILE_TABS = { estimate: "estimates", repair_order: "repairorders", invoice: "invoices" };
const LIST_TABS = { "/Estimates": "estimates", "/RepairOrders": "repairorders", "/Invoices": "invoices" };

// Module lists and this same customer's profile map back to the profile; other customers don't.
export function matchListPath(to, customerId) {
  if (typeof to !== "string") return null;
  const [path, query = ""] = to.split("?");
  if (LIST_TABS[path] && !query) return { tab: LIST_TABS[path] };
  if (path === "/CustomerDetails" && customerId && new URLSearchParams(query).get("id") === customerId) return { tab: null };
  return null;
}

export const DOC_TYPES = Object.keys(DETAIL_PATHS);

// The staff customer profile with this document open above it, on the matching tab.
export function profileDocumentPath(customerId, type, id) {
  if (!customerId || !DOC_TYPES.includes(type) || !id) return null;
  const q = new URLSearchParams({ id: customerId, tab: PROFILE_TABS[type], doc: type, docId: id });
  return `/CustomerDetails?${q.toString()}`;
}

// Opens the canonical document view and remembers the customer profile to return to.
export function openDocument(navigate, type, id) {
  const path = documentPath(type, id);
  if (!path) return;
  navigate(path, { state: { returnTo: window.location.pathname + window.location.search } });
}

const summarize = (names) => {
  const clean = (names || []).filter(Boolean);
  if (clean.length <= 2) return clean.join(", ");
  return `${clean.slice(0, 2).join(", ")} +${clean.length - 2} More`;
};

// Read-only display summary built from the saved record (no recalculation).
export function describeDocument(type, doc) {
  const shortId = doc.id ? doc.id.slice(0, 8) : "";
  if (type === "invoice") {
    const open = ["unpaid", "partial", "overdue"].includes(doc.status);
    return {
      label: "Invoice", number: doc.invoice_number || shortId, title: doc.service_reason || "",
      total: doc.total, balance: open && doc.balance_due > 0 ? doc.balance_due : null,
      items: summarize([...(doc.line_items || []).map((i) => i.name), ...(doc.parts_used || []).map((p) => p.name)]),
    };
  }
  if (type === "estimate") {
    return {
      label: "Estimate", number: doc.estimate_number || shortId, title: doc.service_reason || "",
      total: doc.grand_total, balance: null,
      items: summarize([...(doc.parts_items || []).map((p) => p.name), ...(doc.labor_items || []).map((l) => l.description)]),
    };
  }
  return {
    label: "Repair Order", number: doc.order_number || shortId, title: doc.description || "",
    total: doc.total_cost, balance: null, mechanic: doc.mechanic_name || "",
    items: summarize([...(doc.parts_used || []).map((p) => p.name), ...(doc.labor_items || []).map((l) => l.description)]),
  };
}