import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import SafeBackfillConfirmDialog from "@/components/settings/SafeBackfillConfirmDialog";
import OwnershipActionConfirmDialog from "@/components/settings/OwnershipActionConfirmDialog";
import OwnershipEvidenceQueue from "@/components/settings/OwnershipEvidenceQueue";

const unwrap = (value) => value?.data || value || {};

export default function LegacyPortalMigrationPanel() {
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const run = async (mode = "dry_run") => {
    setBusy(true); setError("");
    try {
      const payload = mode === "apply" ? { mode, confirm: "APPLY_SAFE_BACKFILLS" } : { mode: "dry_run" };
      setReport(unwrap(await base44.functions.invoke("migrateLegacyPortalOwnership", payload)));
    } catch (failure) { setError(failure?.response?.data?.error || failure.message || "Action failed"); }
    setBusy(false); setConfirmOpen(false);
  };
  const requestAction = (type, customerId) => {
    const evidence = report?.review?.ownership_evidence?.[customerId];
    const reason = evidence?.tenants?.length || evidence?.relationship_conflicts?.length ? "conflicting_tenant_evidence" : "no_authoritative_tenant_evidence";
    setPending(type === "assign" ? { type, customerId, title: "Assign from verified relationships?", description: "The server will independently re-check registered-shop evidence. No tenant value is accepted from this screen." } : { type, customerId, reason, title: "Keep customer hard-quarantined?", description: "Portal sessions will be revoked and passcodes disabled. Historical records will remain unchanged." });
  };
  const confirmAction = async () => {
    setBusy(true); setError("");
    try {
      const payload = pending.type === "assign" ? { action: "assign_from_relationship_evidence", customer_id: pending.customerId } : { action: "hard_quarantine_unscoped_customer", customer_id: pending.customerId, reason: pending.reason, review_notes: "Kept hard-quarantined from Center Control" };
      setResult(unwrap(await base44.functions.invoke("resolveLegacyPortalOwnership", payload)));
      setPending(null); await run();
    } catch (failure) { setError(failure?.response?.data?.error || failure.message || "Action failed"); setBusy(false); }
  };
  const runVerifiedBatch = async (apply = false) => {
    setBusy(true); setError("");
    try { setResult(unwrap(await base44.functions.invoke("resolveVerifiedUnscopedCustomers", apply ? { mode: "apply", confirm: "RESOLVE_VERIFIED_17" } : { mode: "dry_run" }))); if (apply) await run(); }
    catch (failure) { setError(failure?.response?.data?.error || failure.message || "Action failed"); }
    setBusy(false); setPending(null);
  };
  const counts = report?.counts;
  const queue = report?.review;
  return <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-4">
    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-400" /><h2 className="text-xl font-semibold text-white">Legacy Portal Migration</h2></div>
    <p className="text-sm text-gray-400">Review authoritative relationship evidence. Customer contact, service, financial, and relationship values are never used as tenant guesses or rewritten.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={() => run()} disabled={busy} variant="outline">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Run Dry Scan</Button><Button onClick={() => setConfirmOpen(true)} disabled={busy || !counts} className="bg-sky-600 hover:bg-sky-500">Apply Safe Backfills</Button><Button onClick={() => runVerifiedBatch(false)} disabled={busy} variant="outline">Dry Run Verified 17</Button><Button onClick={() => setPending({ type: "batch", title: "Resolve verified 17-record set?", description: "Each record will be independently revalidated. Six may resolve only to Haj Rims; unsupported records will be hard-quarantined. Changed evidence will stop the action." })} disabled={busy} className="bg-amber-600 hover:bg-amber-500">Resolve Verified 17</Button></div>
    {error && <p className="rounded-md bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
    {result && <pre className="max-h-48 overflow-auto rounded-md bg-gray-950 p-3 text-xs text-emerald-300">{JSON.stringify(result.counts || result, null, 2)}</pre>}
    {counts && <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(counts).filter(([, value]) => typeof value === "number").map(([key, value]) => <div key={key} className="rounded-md bg-gray-800 p-3"><div className="text-lg font-bold text-white">{value}</div><div className="text-xs text-gray-400">{key.replaceAll("_", " ")}</div></div>)}</div>}
    {queue && <OwnershipEvidenceQueue queue={queue} evidence={queue.ownership_evidence} onAction={requestAction} />}
    <p className="text-xs text-amber-400">Conflicting or missing evidence is never assigned automatically; hard-quarantined customers remain portal-denied.</p>
    <SafeBackfillConfirmDialog open={confirmOpen} busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={() => run("apply")} />
    <OwnershipActionConfirmDialog action={pending} busy={busy} onCancel={() => setPending(null)} onConfirm={() => pending?.type === "batch" ? runVerifiedBatch(true) : confirmAction()} />
  </section>;
}