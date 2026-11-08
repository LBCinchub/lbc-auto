import React from "react";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import StripeSetupNotice from "./StripeSetupNotice";

// Not connected yet: one clear button that opens the guided connect window.
// Always clickable (except while checking), so a click never silently does nothing.
export default function StripeConnectStart({ available, isAdmin, light, starting, onStart }) {
  return (
    <div className="space-y-3">
      {!available && <StripeSetupNotice light={light} isAdmin={isAdmin} />}
      <Button type="button" disabled={starting} onClick={onStart} className="bg-sky-500 hover:bg-sky-600 gap-2">
        {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
        {starting ? "Opening…" : "Connect Stripe"}
      </Button>
      <p className={`${light ? "text-gray-600" : "text-gray-500"} flex items-center gap-1.5 text-xs`}>
        <ShieldCheck className="w-4 h-4 shrink-0" /> Your Stripe key is checked with Stripe, encrypted on our server and never shown again.
      </p>
    </div>
  );
}