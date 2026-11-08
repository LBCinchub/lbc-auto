import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const kindOf = (v) => (/^pk_(live|test)_\w+$/.test(v) ? "publishable" : /^(sk|rk)_(live|test)_\w+$/.test(v) ? "secret" : "");
const HINTS = {
  movedPk: "That's your Publishable key, so it went in the second box. Now copy your Secret key in Stripe (click Reveal) and paste it in the first box.",
  movedSk: "That's your Secret key, so it went in the first box, where it stays hidden.",
  needSk: "Paste your Secret key in the first box. It starts with sk_live_ or sk_test_.",
};

// Paste-a-key form. The secret key is checked with Stripe and encrypted on the server; it never
// comes back. The optional publishable key (public by design) lets the card form open inside LBC Auto.
// A key pasted into the wrong box is moved to the right one; the button only waits while busy.
export default function StripeConnectForm({ busy, light, onConnect }) {
  const [key, setKey] = useState("");
  const [pk, setPk] = useState("");
  const [hint, setHint] = useState("");
  const labelCls = `${light ? "text-gray-700" : "text-gray-400"} mb-2 block`;

  const routePaste = (box) => (e) => {
    const text = e.clipboardData.getData("text").trim();
    const kind = kindOf(text);
    if (box === "secret" && kind === "publishable") { e.preventDefault(); setPk(text); setHint(HINTS.movedPk); }
    if (box === "publishable" && kind === "secret") { e.preventDefault(); setKey(text); setHint(HINTS.movedSk); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const secret = key.trim();
    if (!secret || kindOf(secret) === "publishable") { setHint(HINTS.needSk); return; }
    setHint("");
    if (await onConnect(secret, pk.trim())) { setKey(""); setPk(""); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="stripe-secret-key" className={labelCls}>Stripe Secret Key</Label>
        <Input id="stripe-secret-key" type="password" autoComplete="off" spellCheck={false} data-no-capitalize aria-label="Stripe secret key"
          value={key} onChange={(e) => { setKey(e.target.value); setHint(""); }} onPaste={routePaste("secret")} placeholder="e.g. sk_live_..." className="bg-gray-800 border-gray-700 text-white" />
        {hint && <p role="alert" className={`${light ? "text-amber-700" : "text-amber-400"} text-sm mt-2`}>{hint}</p>}
      </div>
      <div>
        <Label htmlFor="stripe-publishable-key" className={labelCls}>Publishable Key (optional, to take cards inside LBC Auto)</Label>
        <Input id="stripe-publishable-key" autoComplete="off" spellCheck={false} data-no-capitalize aria-label="Stripe publishable key"
          value={pk} onChange={(e) => setPk(e.target.value)} onPaste={routePaste("publishable")} placeholder="e.g. pk_live_..." className="bg-gray-800 border-gray-700 text-white" />
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-sky-500 hover:bg-sky-600 gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
        {busy ? "Checking with Stripe…" : "Connect Stripe"}
      </Button>
    </form>
  );
}