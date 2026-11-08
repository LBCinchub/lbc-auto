import React from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StripeConnectedCard({ status, busy, light, onDisconnect }) {
  const live = status.mode === "live";
  const warn = light ? "text-amber-700" : "text-amber-400";
  const disconnect = () => {
    if (window.confirm("Disconnect Stripe? Card payment links will stop working until you connect again.")) onDisconnect();
  };

  return (
    <div className={`${light ? "bg-gray-50 border-gray-200" : "bg-gray-800/50 border-gray-700/50"} border rounded-lg p-4 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className={`w-5 h-5 ${light ? "text-emerald-600" : "text-emerald-400"}`} />
        <span className={`font-semibold ${light ? "text-gray-900" : "text-white"}`}>{status.account_name || "Your Stripe account"} is connected</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${live ? (light ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/15 text-emerald-400") : (light ? "bg-amber-100 text-amber-700" : "bg-amber-500/15 text-amber-400")}`}>
          {live ? "Live" : "Test mode"}
        </span>
      </div>
      <p className={`${light ? "text-gray-600" : "text-gray-400"} text-sm`}>
        Key ending in ••••{status.key_last4}{status.currency ? ` · Payments in ${status.currency}` : ""}
      </p>
      {!live && <p className={`${warn} text-sm`}>Test mode: no real money moves. Pay with card 4242 4242 4242 4242 to try it.</p>}
      {!status.charges_enabled && (
        <p className={`${warn} flex items-start gap-1.5 text-sm`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Stripe says this account can't take payments yet. Finish setting up your account in Stripe.
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={disconnect} disabled={busy} className={`gap-2 border-rose-500/40 ${light ? "text-rose-600" : "text-rose-400 hover:text-rose-300"}`}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Disconnect Stripe
      </Button>
    </div>
  );
}