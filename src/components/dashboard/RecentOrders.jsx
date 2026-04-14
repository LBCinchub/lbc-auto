import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  waiting: { label: "Waiting", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  in_progress: { label: "In Progress", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  waiting_for_parts: { label: "Waiting for Parts", class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  completed: { label: "Completed", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Delivered", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function RecentOrders({ orders }) {
  const sorted = [...orders].sort((a, b) => {
    const isDeliveredA = a.status === "delivered" ? 1 : 0;
    const isDeliveredB = b.status === "delivered" ? 1 : 0;
    return isDeliveredA - isDeliveredB;
  });
  const recent = sorted.slice(0, 8);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Recent Repair Orders</h3>
        <Link to={createPageUrl("RepairOrders")} className="text-xs text-sky-400 hover:text-sky-300">
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {recent.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No repair orders yet</p>
        )}
        {recent.map((order) => {
          const config = statusConfig[order.status] || statusConfig.waiting;
          return (
            <Link
              key={order.id}
              to={createPageUrl(`RepairOrders?id=${order.id}`)}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{order.vehicle_info || "Unknown Vehicle"}</p>
                <p className="text-xs text-gray-500 truncate">{order.customer_name} · {order.order_number}</p>
              </div>
              <Badge variant="outline" className={cn("text-xs flex-shrink-0 ml-3", config.class)}>
                {config.label}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}