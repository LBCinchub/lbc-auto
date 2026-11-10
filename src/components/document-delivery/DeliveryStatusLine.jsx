import React from "react";
import { CheckCircle2, Clock, Loader2, XCircle, Send } from "lucide-react";

// "Delivered" appears only when Twilio reports the carrier delivered it.
const LOOK = {
  preparing: { icon: Loader2, spin: true, cls: "text-gray-400", label: "Preparing PDF…" },
  queued: { icon: Clock, cls: "text-sky-400", label: "Queued with Twilio, not delivered yet" },
  sending: { icon: Loader2, spin: true, cls: "text-sky-400", label: "Sending to the carrier…" },
  sent: { icon: Send, cls: "text-amber-400", label: "Sent to the carrier, waiting for delivery confirmation" },
  delivered: { icon: CheckCircle2, cls: "text-emerald-400", label: "Delivered to the customer's phone" },
  undelivered: { icon: XCircle, cls: "text-rose-400", label: "Not delivered" },
  failed: { icon: XCircle, cls: "text-rose-400", label: "Failed, the PDF was not sent" },
  canceled: { icon: XCircle, cls: "text-gray-400", label: "Canceled" },
};

export default function DeliveryStatusLine({ delivery }) {
  if (!delivery) return null;
  const look = LOOK[delivery.status] || LOOK.queued;
  const Icon = look.icon;
  const when = delivery.status_updated_at ? new Date(delivery.status_updated_at).toLocaleString() : "";
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-sm" role="status">
      <div className={`flex items-center gap-2 font-medium ${look.cls}`}>
        <Icon className={`h-4 w-4 shrink-0 ${look.spin ? "animate-spin" : ""}`} /> {look.label}
      </div>
      {delivery.error && <p className="mt-1 text-rose-300">{delivery.error}{delivery.error_code ? ` (code ${delivery.error_code})` : ""}</p>}
      <p className="mt-1 text-xs text-gray-500">
        {delivery.document_number} · {delivery.file_name}{delivery.file_kb ? ` (${delivery.file_kb} KB)` : ""} · to {delivery.to}{when ? ` · ${when}` : ""}
      </p>
    </div>
  );
}