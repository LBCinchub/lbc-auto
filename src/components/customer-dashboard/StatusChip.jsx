import React from "react";
import { statusLabel } from "@/components/customer-dashboard/portalUtils";

export default function StatusChip({ status = "pending" }) {
  const positive = ["paid", "approved", "completed", "delivered", "confirmed", "resolved"].includes(status);
  const urgent = ["declined", "cancelled", "overdue", "critical"].includes(status);
  const tone = positive ? "portal-chip-success" : urgent ? "portal-chip-danger" : "portal-chip-info";
  return <span className={`portal-chip ${tone}`}>{statusLabel(status)}</span>;
}