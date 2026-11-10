import React from "react";
import { ChevronRight, Ghost, User } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { describeDocument } from "@/lib/customerDocuments";
import InvoiceProfileActions from "@/components/document-actions/InvoiceProfileActions";
import EstimateProfileActions from "@/components/document-actions/EstimateProfileActions";
import RepairOrderProfileActions from "@/components/document-actions/RepairOrderProfileActions";

const money = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const ACTIONS = { invoice: InvoiceProfileActions, estimate: EstimateProfileActions, repair_order: RepairOrderProfileActions };

// One customer document: readable summary (opens the full editor above the profile)
// plus the same staff actions its main page offers.
export default function CustomerDocumentCard({ type, doc, customer, onOpen, onChanged, children }) {
  const d = describeDocument(type, doc);
  const Actions = ACTIONS[type];
  const paid = parseFloat(doc.amount_paid) || 0;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 transition-colors hover:border-sky-500/40">
      <button type="button" onClick={() => onOpen(type, doc.id)} aria-label={`Open ${d.label} ${d.number}`}
        className="w-full min-h-[44px] rounded-t-xl p-4 text-left flex items-start justify-between gap-3 hover:bg-gray-800/40">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{d.label}</span>
            <span className="font-semibold text-white">#{d.number}</span>
            <StatusBadge status={doc.status} />
            {doc.ghost_status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <Ghost className="h-2.5 w-2.5" /> Remaining Work
              </span>
            )}
          </div>
          {d.title && <p className="mt-0.5 truncate text-sm text-gray-300">{d.title}</p>}
          <p className="mt-0.5 text-xs text-gray-500">
            {doc.created_date ? new Date(doc.created_date).toLocaleDateString("en-CA") : "—"} · {doc.vehicle_info || "—"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            {d.items && <span className="truncate text-gray-400">{d.items}</span>}
            {d.mechanic && <span className="inline-flex items-center gap-1 text-sky-400/80"><User className="h-3 w-3" />{d.mechanic}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <dl className="text-right">
            <dt className="text-[11px] text-gray-500">Total</dt>
            <dd className="text-sm font-bold text-white">{money(d.total)}</dd>
            {type === "invoice" && paid > 0 && <><dt className="mt-1 text-[11px] text-gray-500">Paid</dt><dd className="text-xs font-semibold text-emerald-400">{money(paid)}</dd></>}
            {d.balance != null && <><dt className="mt-1 text-[11px] text-gray-500">Balance Due</dt><dd className="text-sm font-bold text-yellow-400">{money(d.balance)}</dd></>}
          </dl>
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </div>
      </button>
      {children && <div className="px-4">{children}</div>}
      <div className="border-t border-gray-800 px-3 py-2">
        <Actions doc={doc} customer={customer} onOpen={onOpen} onChanged={onChanged} />
      </div>
    </div>
  );
}