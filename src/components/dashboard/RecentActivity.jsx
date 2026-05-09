import React from "react";
import { useNavigate } from "react-router-dom";
import { Wrench, FileText, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";

export default function RecentActivity({ orders, invoices, customers = [] }) {
  const navigate = useNavigate();
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
  const recentInvoices = [...invoices].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Repair Orders */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-sky-400" /> Recent Repair Orders
        </h3>
        <div className="space-y-2">
          {recentOrders.length === 0 && <p className="text-gray-600 text-sm text-center py-4">No repair orders yet</p>}
          {recentOrders.map(o => (
            <button key={o.id} onClick={() => navigate(`/RepairOrderDetail/${o.id}`)}
              className="w-full flex items-center justify-between gap-3 rounded-lg bg-gray-800/50 px-3 py-2 hover:bg-gray-800 transition-colors text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">#{o.order_number || o.id?.slice(0,6)}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs truncate">
                  <span className="text-blue-400">{o.customer_name}</span>
                </p>
                {(() => { const phone = o.customer_phone || customers.find(c => c.id === o.customer_id)?.phone; return phone ? <p className="text-xs text-amber-400">{phone}</p> : null; })()}
                {o.vehicle_info && <p className="text-xs text-green-400 truncate">{o.vehicle_info}</p>}
                <p className="text-xs text-gray-600">{new Date(o.created_date).toLocaleDateString()}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" /> Recent Invoices
        </h3>
        <div className="space-y-2">
          {recentInvoices.length === 0 && <p className="text-gray-600 text-sm text-center py-4">No invoices yet</p>}
          {recentInvoices.map(inv => (
            <button key={inv.id} onClick={() => navigate(`/InvoiceDetail/${inv.id}`)}
              className="w-full flex items-center justify-between gap-3 rounded-lg bg-gray-800/50 px-3 py-2 hover:bg-gray-800 transition-colors text-left">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">{inv.invoice_number}</span>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-xs truncate">
                  <span className="text-blue-400">{inv.customer_name}</span>
                </p>
                {(() => { const phone = customers.find(c => c.id === inv.customer_id)?.phone; return phone ? <p className="text-xs text-amber-400">{phone}</p> : null; })()}
                {inv.vehicle_info && <p className="text-xs text-green-400 truncate">{inv.vehicle_info}</p>}
                <p className="text-xs text-gray-600">{new Date(inv.created_date).toLocaleDateString()}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-white">${(inv.total || 0).toFixed(2)}</p>
                <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}