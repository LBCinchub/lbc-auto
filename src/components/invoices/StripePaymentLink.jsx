import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import StripeLinkActions from "./StripeLinkActions";

const errorOf = (e) => e?.response?.data?.error || e?.message || "Card payment link failed";

// Optional card payment link through the shop's own Stripe (connected in Settings).
// Renders nothing until the shop has connected Stripe.
export default function StripePaymentLink({ invoiceId, ensureInvoiceId, canPay, customerPhone, onPaid }) {
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const creating = useRef(false);

  const run = async (action, resolveId = async () => invoiceId) => {
    setBusy(action);
    setError("");
    try {
      const id = await resolveId();
      const res = await base44.functions.invoke("shopStripe", id ? { action, invoice_id: id } : { action: "status" });
      setState(id ? res.data : { connected: !!res.data?.connected, link: null });
      if (res.data?.paid_now) {
        toast({ title: "Card payment received", description: "The Stripe payment was added to this invoice." });
        await onPaid?.();
      }
    } catch (e) {
      setError(errorOf(e));
    } finally {
      setBusy("");
    }
  };

  // Wait until the dialog knows whether an invoice is saved; the create flow loads its own result.
  useEffect(() => { if (invoiceId !== undefined && !creating.current) run("link_status"); }, [invoiceId]);

  const create = async () => {
    creating.current = true;
    await run("create_link", async () => invoiceId || ensureInvoiceId());
    creating.current = false;
  };

  const link = state?.link;
  if (!state || (!state.connected && !link) || (!link && !canPay)) return null;
  return (
    <div className="space-y-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-sky-400"><CreditCard className="h-4 w-4" /> Card payment link (Stripe)</p>
      {!link && <>
        <p className="text-xs text-gray-400">Send or show your customer a secure link for the balance due. When they pay, it's recorded here automatically.</p>
        <Button type="button" size="sm" onClick={create} disabled={!!busy} className="gap-2 bg-sky-500 hover:bg-sky-600">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Create payment link
        </Button>
      </>}
      {link?.status === "open" && <StripeLinkActions link={link} busy={busy} customerPhone={customerPhone} onCheck={() => run("link_status")} onCancel={() => run("cancel_link")} />}
      {link?.status === "needs_review" && <>
        <p className="text-xs text-amber-400">{link.note}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => run("cancel_link")} disabled={!!busy} className="h-8 border-gray-700 text-xs">Dismiss</Button>
      </>}
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}