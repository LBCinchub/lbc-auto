import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Paste-a-key form. The key is checked with Stripe and encrypted on the server; it never comes back.
export default function StripeConnectForm({ busy, light, onConnect }) {
  const [key, setKey] = useState("");
  const trimmed = key.trim();
  const publishable = trimmed.startsWith("pk_");

  const submit = async (e) => {
    e.preventDefault();
    if (publishable) return;
    if (await onConnect(trimmed)) setKey("");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="stripe-secret-key" className={`${light ? "text-gray-700" : "text-gray-400"} mb-2 block`}>Stripe Secret Key</Label>
        <Input
          id="stripe-secret-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          data-no-capitalize
          aria-label="Stripe secret key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="e.g. sk_live_..."
          className="bg-gray-800 border-gray-700 text-white"
        />
        {publishable && (
          <p role="alert" className={`${light ? "text-amber-700" : "text-amber-400"} text-sm mt-2`}>
            That's your Publishable key. Copy the Secret key instead (it starts with sk_).
          </p>
        )}
      </div>
      <Button type="submit" disabled={busy || !trimmed || publishable} className="w-full bg-sky-500 hover:bg-sky-600 gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {busy ? "Checking with Stripe…" : "Connect Stripe"}
      </Button>
    </form>
  );
}