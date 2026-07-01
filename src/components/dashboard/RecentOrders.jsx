import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/utils/formatPhone";

const statusConfig = {
  waiting: { label: "Waiting", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  in_progress: { label: "In Progress", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  waiting_for_parts: { label: "Waiting for Parts", class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  completed: { label: "Completed", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Delivered", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
};

export default function RecentOrders({ orders, customers = [] }) {
  const navigate = useNavigate();
  const priority = { in_progress: 0, waiting: 1, waiting_for_parts: 2, completed: 3, delivered: 4 };
  const sorted = [...orders]
    .sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5) || new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 15);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Recent Repair Orders</h3>
        <button onClick={() => navigate("/RepairOrders")} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
          View all →
        </button>
      </div>
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
        {sorted.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No repair orders yet</p>
        )}
        {sorted.map((order) => {
          const config = statusConfig[order.status] || statusConfig.waiting;
          return (
            <button
              key={order.id}
              onClick={() => navigate(`/RepairOrderDetail/${order.id}`)}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base text-blue-400 font-semibold truncate capitalize">{order.customer_name}</p>
                  {order.order_number && <span className="text-sm text-gray-400 flex-shrink-0">#{order.order_number}</span>}
                </div>
                {(() => { const phone = order.customer_phone || customers.find(c => c.id === order.customer_id)?.phone; return phone ? <p className="text-sm text-amber-400">{formatPhone(phone)}</p> : null; })()}
                <p className="text-sm text-green-400 truncate capitalize">{order.vehicle_info || "Unknown Vehicle"}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <Badge variant="outline" className={cn("text-sm", config.class)}>
                  {config.label}
                </Badge>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}