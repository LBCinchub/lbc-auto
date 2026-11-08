import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Paste-a-key form. The secret key is checked with Stripe and encrypted on the server; it never
// comes back. The optional publishable key (public by design) lets the card form open inside LBC Auto.
export default function StripeConnectForm({ busy, light, onConnect }) {
  const [key, setKey] = useState("");
  const [pk, setPk] = useState("");
  const trimmed = key.trim();
  const publishable = trimmed.startsWith("pk_");
  const labelCls = `${light ? "text-gray-700" : "text-gray-400"} mb-2 block`;

  const submit = async (e) => {
    e.preventDefault();
    if (publishable) return;
    if (await onConnect(trimmed, pk.trim())) { setKey(""); setPk(""); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="stripe-secret-key" className={labelCls}>Stripe Secret Key</Label>
        <Input id="stripe-secret-key" type="password" autoComplete="off" spellCheck={false} data-no-capitalize aria-label="Stripe secret key"
          value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. sk_live_..." className="bg-gray-800 border-gray-700 text-white" />
        {publishable && (
          <p role="alert" className={`${light ? "text-amber-700" : "text-amber-400"} text-sm mt-2`}>
            That's your Publishable key. Put it in the box below, and paste the Secret key (it starts with sk_) here.
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="stripe-publishable-key" className={labelCls}>Publishable Key (optional, to take cards inside LBC Auto)</Label>
        <Input id="stripe-publishable-key" autoComplete="off" spellCheck={false} data-no-capitalize aria-label="Stripe publishable key"
          value={pk} onChange={(e) => setPk(e.target.value)} placeholder="e.g. pk_live_..." className="bg-gray-800 border-gray-700 text-white" />
      </div>
      <Button type="submit" disabled={busy || !trimmed || publishable} className="w-full bg-sky-500 hover:bg-sky-600 gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {busy ? "Checking with Stripe…" : "Connect Stripe"}
      </Button>
    </form>
  );
}