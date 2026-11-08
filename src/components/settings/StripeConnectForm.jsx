import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Paste-a-key form. The key is checked with Stripe and encrypted on the server; it never comes back.
export default function StripeConnectForm({ busy, light, disabled = false, onConnect }) {
  const [key, setKey] = useState("");
  const hint = light ? "text-gray-600" : "text-gray-500";

  const submit = async (e) => {
    e.preventDefault();
    if (await onConnect(key.trim())) setKey("");
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
          disabled={disabled}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="e.g. sk_live_..."
          className={light ? "bg-gray-50 border-gray-300 text-gray-900" : "bg-gray-800 border-gray-700 text-white"}
        />
        <p className={`${hint} text-sm mt-2`}>In your Stripe dashboard, open Developers → API keys and copy the Secret key. Start with a test key (sk_test_) to try it safely.</p>
      </div>
      <Button type="submit" disabled={disabled || busy || !key.trim()} className="bg-sky-500 hover:bg-sky-600 gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {busy ? "Checking with Stripe…" : "Connect Stripe"}
      </Button>
      <p className={`${hint} text-xs`}>Your key is encrypted and only used by the server to create payment links. It is never shown again.</p>
    </form>
  );
}