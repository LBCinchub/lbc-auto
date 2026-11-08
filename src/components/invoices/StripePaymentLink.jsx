import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import StripeLinkActions from "./StripeLinkActions";
import CardCheckoutOverlay from "./CardCheckoutOverlay";

const errorOf = (e) => e?.response?.data?.error || e?.message || "Card payment failed";
const UNCONFIRMED = "Stripe has not confirmed this payment yet. Nothing was recorded. Check again in a moment.";

// Optional card payments through the shop's own Stripe (connected in Settings): a shareable
// payment link, or Stripe's card form inside LBC Auto. Renders nothing until Stripe is connected.
// A payment is only recorded after the server confirms it with Stripe.
export default function StripePaymentLink({ invoiceId, ensureInvoiceId, canPay, customerPhone, onPaid }) {
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(null); // { clientSecret, amount, verifying, message }
  const creating = useRef(false);

  const call = async (action, extra = {}, resolveId = async () => invoiceId) => {
    const id = await resolveId();
    const res = await base44.functions.invoke("shopStripe", id ? { action, invoice_id: id, ...extra } : { action: "status" });
    setState(id ? res.data : { ...res.data, link: null });
    if (res.data?.paid_now) {
      toast({ title: "Card payment received", description: "Stripe confirmed the payment and it was added to this invoice." });
      await onPaid?.();
    }
    return res.data;
  };

  const run = async (action, extra, resolveId) => {
    setBusy(action);
    setError("");
    try { return await call(action, extra, resolveId); } catch (e) { setError(errorOf(e)); return null; } finally { setBusy(""); }
  };

  // Wait until the dialog knows whether an invoice is saved; the create flow loads its own result.
  useEffect(() => { if (invoiceId !== undefined && !creating.current) run("link_status"); }, [invoiceId]);

  const create = async (inApp) => {
    creating.current = true;
    const data = await run("create_link", inApp ? { in_app: true } : {}, async () => invoiceId || ensureInvoiceId());
    creating.current = false;
    if (inApp && data?.client_secret) setCheckout({ clientSecret: data.client_secret, amount: data.link?.amount, verifying: false, message: "" });
  };

  // Stripe's form finished: confirm on the server. Only a server-confirmed payment closes the overlay.
  const confirm = async () => {
    setCheckout((c) => c && { ...c, verifying: true, message: "" });
    try {
      const data = await call("link_status");
      if (data?.paid_now || data?.link?.status === "paid") return setCheckout(null);
      if (data?.link?.status === "needs_review") { setCheckout(null); return; }
      setCheckout((c) => c && { ...c, verifying: false, message: UNCONFIRMED });
    } catch (e) {
      setCheckout((c) => c && { ...c, verifying: false, message: `${errorOf(e)} Nothing was recorded yet.` });
    }
  };

  // Closed without finishing: the server checks Stripe first (records it if it was paid), then closes it.
  const closeCheckout = async () => { setCheckout(null); await run("close_open"); };

  const link = state?.link;
  if (!state || (!state.connected && !link) || (!link && !canPay)) return null;
  const ready = state.charges_enabled;
  return (
    <div className="space-y-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-sky-400"><CreditCard className="h-4 w-4" /> Card payment (Stripe{state.mode === "test" ? " · test mode" : ""})</p>
      {!link && !ready && <p className="text-xs text-amber-400">Stripe says your account can't take payments yet. Finish setting it up in Stripe, then reopen this window.</p>}
      {!link && ready && <>
        <p className="text-xs text-gray-400">Charge the balance due by card. It's added to this invoice only after Stripe confirms the payment.</p>
        <div className="flex flex-wrap gap-2">
          {state.in_app_ready && (
            <Button type="button" size="sm" onClick={() => create(true)} disabled={!!busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              {busy === "create_link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorSmartphone className="h-4 w-4" />} Collect card payment
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => create(false)} disabled={!!busy} className="gap-2 bg-sky-500 hover:bg-sky-600">
            {busy === "create_link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Create payment link
          </Button>
        </div>
        {!state.in_app_ready && <p className="text-xs text-gray-500">To take the card here on this screen, add your Stripe publishable key in Settings.</p>}
      </>}
      {link?.status === "open" && !link.in_app && <StripeLinkActions link={link} busy={busy} customerPhone={customerPhone} onCheck={() => run("link_status")} onCancel={() => run("cancel_link")} />}
      {link?.status === "open" && link.in_app && !checkout && <>
        <p className="text-xs text-gray-400">{state.processing ? UNCONFIRMED : "A card checkout for this invoice was left open."}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => run("link_status")} disabled={!!busy} className="h-8 border-gray-700 text-xs">Check payment</Button>
          {!state.processing && <Button type="button" size="sm" variant="outline" onClick={() => run("close_open")} disabled={!!busy} className="h-8 border-gray-700 text-xs text-rose-400">Close checkout</Button>}
        </div>
      </>}
      {link?.status === "needs_review" && <>
        <p className="text-xs text-amber-400">{link.note}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => run("cancel_link")} disabled={!!busy} className="h-8 border-gray-700 text-xs">Dismiss</Button>
      </>}
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {checkout && (
        <CardCheckoutOverlay publishableKey={state.publishable_key} clientSecret={checkout.clientSecret} amount={checkout.amount}
          verifying={checkout.verifying} message={checkout.message} onComplete={confirm} onCheckAgain={confirm} onClose={closeCheckout} />
      )}
    </div>
  );
}