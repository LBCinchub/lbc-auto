import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import SafeBackfillConfirmDialog from "@/components/settings/SafeBackfillConfirmDialog";

const unwrap = (value) => value?.data || value || {};

export default function LegacyPortalMigrationPanel() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const run = async (mode) => {
    setBusy(true);
    const payload = mode === "apply" ? { mode, confirm: "APPLY_SAFE_BACKFILLS" } : { mode: "dry_run" };
    setReport(unwrap(await base44.functions.invoke("migrateLegacyPortalOwnership", payload)));
    setBusy(false);
    setConfirmOpen(false);
  };
  const resolve = async (payload) => {
    setBusy(true);
    await base44.functions.invoke("resolveLegacyPortalOwnership", payload);
    await run("dry_run");
  };
  const counts = report?.counts;
  const queue = report?.review;
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-4">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-400" /><h2 className="text-xl font-semibold text-white">Legacy Portal Migration</h2></div>
      <p className="text-sm text-gray-400">Review historical ownership metadata. Safe backfills add tenant metadata only; service and financial records are never rewritten.</p>
      <div className="flex gap-2"><Button onClick={() => run("dry_run")} disabled={busy} variant="outline">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Run Dry Scan</Button><Button onClick={() => setConfirmOpen(true)} disabled={busy || !counts} className="bg-sky-600 hover:bg-sky-500">Apply Safe Backfills</Button></div>
      {counts && <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(counts).filter(([, value]) => typeof value === "number").map(([key, value]) => <div key={key} className="rounded-md bg-gray-800 p-3"><div className="text-lg font-bold text-white">{value}</div><div className="text-xs text-gray-400">{key.replaceAll("_", " ")}</div></div>)}</div>}
      {queue && <div className="space-y-2"><h3 className="font-semibold text-white">Review queue</h3>{[["Ambiguous customers", queue.ambiguous_customer_ids], ["Unscoped customers", queue.unscoped_customer_ids], ["Conflicts", queue.conflicting_related_records], ["Orphans", queue.orphaned_relationships]].map(([label, items]) => <details key={label} className="rounded-md border border-gray-800 p-3"><summary className="cursor-pointer text-sm text-gray-300">{label} ({items?.length || 0})</summary><div className="mt-2 max-h-48 overflow-auto space-y-1">{(items || []).map((item, index) => <div key={index} className="text-xs font-mono text-gray-400">{typeof item === "string" ? <><span>{item}</span><span className="ml-2 space-x-1"><button onClick={() => resolve({ action: label === "Unscoped customers" ? "assign_current_shop" : "confirm_explicit", customer_id: item })} className="text-sky-400">Resolve for my shop</button>{label === "Ambiguous customers" && <button onClick={() => resolve({ action: "confirm_creator", customer_id: item })} className="text-violet-400">Confirm creator</button>}</span></> : <><span>{`${item.entity}:${item.id} — ${item.reason}`}</span><button onClick={() => resolve({ action: "acknowledge_quarantine", entity: item.entity, record_id: item.id })} className="ml-2 text-amber-400">Keep quarantined</button></>}</div>)}</div></details>)}</div>}
      <p className="text-xs text-amber-400">Conflicts are never reassigned automatically. Open the matching customer record for explicit one-by-one review.</p>
      <SafeBackfillConfirmDialog open={confirmOpen} busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => run("apply")} />
    </section>
  );
}