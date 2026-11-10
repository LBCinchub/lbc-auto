import React from "react";
import { CheckCircle2, Clock, HelpCircle, Loader2, Send, XCircle } from "lucide-react";
import { TEXT_LABELS } from "./deliveryUi";

const LOOK = {
  preparing: [Loader2, "text-gray-400", true], queued: [Clock, "text-sky-400"], sending: [Loader2, "text-sky-400", true],
  sent: [Send, "text-amber-400"], delivered: [CheckCircle2, "text-emerald-400"], undelivered: [XCircle, "text-rose-400"],
  failed: [XCircle, "text-rose-400"], canceled: [XCircle, "text-gray-400"], unknown: [HelpCircle, "text-amber-300"], not_sent: [XCircle, "text-gray-400"],
};

// Per-part provider status. "Delivered" only appears when Twilio reports the carrier delivered it.
export default function TextPartsStatus({ group, title }) {
  if (!group) return null;
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-sm" role="status">
      <p className="mb-1 text-xs text-gray-500">{title} · {group.document_number} · to {group.to}{group.part_count > 1 ? ` · ${group.accepted} of ${group.part_count} texts accepted by Twilio` : ""}</p>
      {group.parts.map((p) => {
        const [Icon, cls, spin] = LOOK[p.status] || LOOK.queued;
        return (
          <div key={p.index} className="py-0.5">
            <div className={`flex items-center gap-2 font-medium ${cls}`}>
              <Icon className={`h-4 w-4 shrink-0 ${spin ? "animate-spin" : ""}`} />
              {group.part_count > 1 ? `Text ${p.index}: ` : ""}{TEXT_LABELS[p.status] || p.status}
            </div>
            {p.error && <p className="ml-6 text-xs text-rose-300">{p.error}{p.error_code && p.error_code !== "no_answer" ? ` (code ${p.error_code})` : ""}</p>}
          </div>
        );
      })}
    </div>
  );
}