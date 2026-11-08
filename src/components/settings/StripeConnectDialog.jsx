import React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StripeConnectForm from "./StripeConnectForm";

const STEPS = [
  "Open your Stripe API keys page (it opens in a new tab).",
  "Next to Secret key, click Reveal, then copy the key.",
  "Paste it below and click Connect Stripe.",
];

// Guided connect window. Closing it discards whatever was typed.
export default function StripeConnectDialog({ open, onOpenChange, busy, error, light, onConnect }) {
  const muted = light ? "text-gray-600" : "text-gray-400";
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Connect your Stripe account</DialogTitle>
          <DialogDescription className={muted}>Takes about a minute. Card payments go straight to your own Stripe.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-2">
          {STEPS.map((text, i) => (
            <li key={text} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-xs font-semibold text-sky-500">{i + 1}</span>
              <span className={`${muted} pt-0.5`}>{text}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2 border-gray-700 bg-transparent">
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> Open Stripe API keys</a>
          </Button>
          <Button asChild variant="ghost" size="sm" className={muted}>
            <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer">Try with test keys</a>
          </Button>
        </div>
        <StripeConnectForm busy={busy} light={light} onConnect={onConnect} />
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <p className={`${muted} flex items-start gap-1.5 text-xs`}>
          <ShieldCheck className="w-4 h-4 shrink-0" /> Your key is checked with Stripe, encrypted on our server and only used to create your payment links. It is never shown again.
        </p>
      </DialogContent>
    </Dialog>
  );
}