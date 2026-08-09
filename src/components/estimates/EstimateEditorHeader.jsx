import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";

export default function EstimateEditorHeader({ estimate, customer, vehicle, linkedInvoice, linkedRO }) {
  return (
    <div className="border-b border-gray-800 px-5 py-4 md:px-6">
      <div className="flex items-start justify-between gap-4 pr-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Estimate</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{estimate?.estimate_number || "New Estimate"}</h2>
            {estimate && <StatusBadge status={estimate.status} />}
            {estimate?.customer_decision === "approved" && (
              <span className="text-xs text-emerald-400">
                · Customer Approved{estimate.customer_decision_name ? ` · ${estimate.customer_decision_name}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-white">{customer?.full_name || estimate?.customer_name || "—"}</p>
          <p className="text-gray-400">
            {vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() : estimate?.vehicle_info || ""}
          </p>
        </div>
      </div>
      {(linkedInvoice || linkedRO) && (
        <p className="mt-2 text-xs text-gray-500">
          {linkedInvoice?.invoice_number && `Invoice ${linkedInvoice.invoice_number}`}
          {linkedInvoice && linkedRO && " · "}
          {linkedRO?.order_number && `Repair Order ${linkedRO.order_number}`}
        </p>
      )}
    </div>
  );
}