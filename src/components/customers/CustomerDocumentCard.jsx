import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Ghost, User } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import { describeDocument, openDocument } from "@/lib/customerDocuments";

const money = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

// One customer document row; opens the same full view the main module uses.
export default function CustomerDocumentCard({ type, doc }) {
  const navigate = useNavigate();
  const d = describeDocument(type, doc);
  return (
    <button
      type="button"
      onClick={() => openDocument(navigate, type, doc.id)}
      className="w-full min-h-[44px] rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-sky-500/40 hover:bg-gray-800/60 flex items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{d.label}</span>
          <span className="font-semibold text-white">#{d.number}</span>
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
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={doc.status} />
          <span className="text-sm font-bold text-white">{money(d.total)}</span>
          {d.balance != null && <span className="text-xs font-semibold text-yellow-400">Balance Due {money(d.balance)}</span>}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-600" />
      </div>
    </button>
  );
}