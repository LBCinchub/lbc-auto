// Display-only mapping of stored Estimate.status. Never rewrites data.
// Unknown/missing statuses render honestly ("Unknown" / raw value), never as Draft.
const NEUTRAL = "bg-gray-500/20 text-gray-400 border-gray-500/30";

export const ESTIMATE_STATUS_CONFIG = {
  draft: { label: "Draft", class: NEUTRAL },
  sent: { label: "Sent", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  approved: { label: "Approved", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  declined: { label: "Declined", class: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  expired: { label: "Expired", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  invoiced: { label: "Invoiced", class: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  cancelled: { label: "Cancelled", class: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
};

export function estimateStatusDisplay(status) {
  const key = String(status || "").trim().toLowerCase();
  if (ESTIMATE_STATUS_CONFIG[key]) return { key, ...ESTIMATE_STATUS_CONFIG[key] };
  return { key: key || "unknown", label: key ? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Unknown", class: NEUTRAL };
}