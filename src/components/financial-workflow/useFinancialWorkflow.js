import { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { calculateFinancials } from "./financialMath";
export default function useFinancialWorkflow({ open, source, onSaved }) {
  const [data, setData] = useState(null), [draft, setDraftState] = useState(null), [step, setStep] = useState(1), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  const keyRef = useRef(crypto.randomUUID());
  const busyRef = useRef(false);
  useEffect(() => { if (!open || !source?.type || !source?.id) return; setLoading(true); setError(""); base44.functions.invoke("financialDocumentAction", { action: "load", source_type: source.type, source_id: source.id, vehicle_id: source.vehicle_id }).then(res => { const next = res.data; setData(next); setDraftState(next.draft); setDirty(false); }).catch(e => setError(e?.response?.data?.error || e.message)).finally(() => setLoading(false)); }, [open, source?.type, source?.id, source?.vehicle_id]);
  const setDraft = (next) => { setDraftState(next); setDirty(true); };
  const totals = useMemo(() => calculateFinancials(draft || { line_items: [] }, data?.invoice?.amount_paid || 0), [draft, data?.invoice?.amount_paid]);
  const act = async (action) => { if (!draft || busyRef.current) return null; busyRef.current = true; setSaving(true); setError(""); try { const res = await base44.functions.invoke("financialDocumentAction", { action: data?.invoice ? (action === "finalize" ? "finalize" : "update") : action, source_type: source.type, source_id: source.id, invoice_id: data?.invoice?.id, idempotency_key: keyRef.current, intent: draft }); const next = res.data; setData(prev => ({ ...prev, ...next })); setDirty(false); onSaved?.(next.invoice); return next.invoice; } catch (e) { setError(e?.response?.data?.error || e.message || "Save failed"); return null; } finally { busyRef.current = false; setSaving(false); } };
  const send = async () => { setSaving(true); setError(""); try { await base44.functions.invoke("financialDocumentAction", { action: "send", source_type: source.type, source_id: source.id, invoice_id: data.invoice.id }); } catch (e) { setError(e?.response?.data?.error || e.message); } finally { setSaving(false); } };
  const reload = async () => { const res = await base44.functions.invoke("financialDocumentAction", { action: "load", source_type: source.type, source_id: source.id }); setData(res.data); setDraftState(res.data.draft); setDirty(false); };
  return { data, draft, setDraft, step, setStep, loading, saving, dirty, error, totals, act, send, reload };
}