import React from "react";
import StatusBadge from "@/components/shared/StatusBadge";

export default function InvoiceEditorHeader({ data }) {
  const invoice = data?.invoice;
  return <div className="border-b border-gray-800 px-5 py-4 md:px-6">
    <div className="flex items-start justify-between gap-4 pr-8">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Invoice</p><div className="mt-1 flex items-center gap-2"><h2 className="text-xl font-bold text-white">{invoice?.invoice_number || "New Invoice"}</h2>{invoice && <StatusBadge status={invoice.status} />}</div></div>
      <div className="text-right text-sm"><p className="font-medium text-white">{data?.customer?.full_name}</p><p className="text-gray-400">{data?.vehicle ? `${data.vehicle.year || ""} ${data.vehicle.make || ""} ${data.vehicle.model || ""}`.trim() : ""}</p></div>
    </div>
    {(data?.estimate || data?.repair_order) && <p className="mt-2 text-xs text-gray-500">{data.estimate?.estimate_number && `Estimate ${data.estimate.estimate_number}`}{data.estimate && data.repair_order && " · "}{data.repair_order?.order_number && `Repair Order ${data.repair_order.order_number}`}</p>}
  </div>;
}