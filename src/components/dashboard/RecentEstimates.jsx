import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/utils/formatPhone";

const statusConfig = {
  draft: { label: "Draft", class: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  sent: { label: "Sent", class: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  approved: { label: "Approved", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  declined: { label: "Declined", class: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  expired: { label: "Expired", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export default function RecentEstimates({ estimates = [], customers = [] }) {
  const navigate = useNavigate();
  const sorted = [...estimates].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 10);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Recent Estimates</h3>
        <button onClick={() => navigate("/Estimates")} className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
          View all →
        </button>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {sorted.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No estimates yet</p>
        )}
        {sorted.map((est) => {
          const config = statusConfig[est.status] || statusConfig.draft;
          const total = est.grand_total ?? ((est.labor_total || 0) + (est.parts_total || 0));
          return (
            <button
              key={est.id}
              onClick={() => navigate(`/EstimateDetail/${est.id}`)}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm text-blue-400 font-medium truncate capitalize">{est.customer_name}</p>
                {est.estimate_number && <span className="text-xs text-gray-500 flex-shrink-0">#{est.estimate_number}</span>}
              </div>
              {(() => { const phone = customers.find(c => c.id === est.customer_id)?.phone; return phone ? <p className="text-xs text-amber-400">{formatPhone(phone)}</p> : null; })()}
              <p className="text-xs text-green-400 truncate capitalize">{est.vehicle_info || "Unknown Vehicle"}</p>
              {total > 0 && <p className="text-xs text-gray-400">${total.toFixed(2)}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <Badge variant="outline" className={cn("text-xs", config.class)}>
                  {config.label}
                </Badge>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}