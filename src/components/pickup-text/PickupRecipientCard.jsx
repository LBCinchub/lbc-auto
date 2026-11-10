import React from "react";

// Who receives the text and who it comes from: the order's own customer and the verified shop.
export default function PickupRecipientCard({ info }) {
  const row = (label, value) => value ? (
    <div className="flex gap-2"><span className="w-24 shrink-0 text-gray-500">{label}</span><span className="break-words text-gray-200">{value}</span></div>
  ) : null;
  return (
    <div className="space-y-1 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm" data-no-capitalize>
      {row("To", [info.customer_name, info.to].filter(Boolean).join(" · ") || "No Phone On File")}
      {row("Repair Order", info.repair_order_number)}
      {row("Vehicle", info.vehicle)}
      {row("From", info.shop?.name)}
      {row("Shop Phone", info.shop?.phone)}
      {row("Shop Address", info.shop?.address)}
    </div>
  );
}