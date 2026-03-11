import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const configs = {
  waiting: { label: "Waiting", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  in_progress: { label: "In Progress", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  waiting_for_parts: { label: "Parts Needed", class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  completed: { label: "Completed", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Delivered", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  paid: { label: "Paid", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  unpaid: { label: "Unpaid", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  overdue: { label: "Overdue", class: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  scheduled: { label: "Scheduled", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  confirmed: { label: "Confirmed", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled", class: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  available: { label: "Available", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  busy: { label: "Busy", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  off_duty: { label: "Off Duty", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function StatusBadge({ status }) {
  const config = configs[status] || { label: status, class: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return (
    <Badge variant="outline" className={cn("text-xs", config.class)}>
      {config.label}
    </Badge>
  );
}