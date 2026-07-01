import React from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig = {
  unpaid:  { label: "Unpaid",  cls: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  partial: { label: "Partial", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  paid:    { label: "Paid",    cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  overdue: { label: "Overdue", cls: "bg-red-600/20 text-red-400 border-red-600/30" },
};

export default function RecentInvoices({ invoices = [], customers = [] }) {
  const navigate = useNavigate();
  const sorted = [...invoices]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 15);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Recent Invoices</h3>
        <button onClick={() => navigate("/Invoices")}
          className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
          View all →
        </button>
      </div>
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {sorted.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No invoices yet</p>
        )}
        {sorted.map((inv) => {
          const cfg = statusConfig[inv.status] || statusConfig.unpaid;
          const balance = inv.balance_due ?? Math.max(0, (inv.total || 0) - (inv.amount_paid || 0));
          return (
            <button
              key={inv.id}
              onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-800/30 hover:bg-gray-700/50 transition-colors text-left gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base text-blue-400 font-semibold truncate capitalize">{inv.customer_name || "—"}</p>
                  {inv.invoice_number && (
                    <span className="text-sm text-gray-400 flex-shrink-0">#{inv.invoice_number}</span>
                  )}
                </div>
                <p className="text-sm text-green-400 truncate capitalize mt-1">{inv.vehicle_info || "—"}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="text-sm text-gray-300">Total: <span className="text-white font-bold text-lg">${(inv.total || 0).toFixed(2)}</span></p>
                  {balance > 0 && inv.status !== "paid" && (
                    <p className="text-sm text-rose-400">Due: ${balance.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={cn("text-sm", cfg.cls)}>{cfg.label}</Badge>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
