import React, { useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// One Stripe.js instance per shop publishable key.
const stripes = new Map();
const stripeFor = (pk) => {
  if (!stripes.has(pk)) stripes.set(pk, loadStripe(pk));
  return stripes.get(pk);
};

// Stripe's own card form, shown inside LBC Auto. Card details go only to Stripe. Finishing the
// form does NOT mark anything paid here: the parent asks the server to confirm with Stripe first.
export default function CardCheckoutOverlay({ publishableKey, clientSecret, amount, verifying, message, onComplete, onCheckAgain, onClose }) {
  const stripePromise = useMemo(() => (publishableKey ? stripeFor(publishableKey) : null), [publishableKey]);
  const options = useMemo(() => ({ clientSecret, onComplete }), [clientSecret]);
  return (
    <Dialog open={!!clientSecret} onOpenChange={(next) => { if (!next && !verifying) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto border-gray-800 bg-gray-950 text-white" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Card payment · ${Number(amount || 0).toFixed(2)} CAD</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-gray-400">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Secure checkout by Stripe. Card details go straight to Stripe.
          </DialogDescription>
        </DialogHeader>
        {stripePromise && clientSecret && (
          <div className="rounded-lg bg-white p-2">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
        {verifying && <p className="flex items-center gap-2 text-sm text-sky-400"><Loader2 className="h-4 w-4 animate-spin" /> Confirming the payment with Stripe…</p>}
        {message && !verifying && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-amber-400">{message}</p>
            <Button type="button" size="sm" variant="outline" onClick={onCheckAgain} className="border-gray-700">Check again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}