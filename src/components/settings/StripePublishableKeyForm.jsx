import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Adds the shop's publishable key (public by design) so card payments can be taken inside LBC Auto.
export default function StripePublishableKeyForm({ mode, busy, light, onSave }) {
  const [pk, setPk] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (await onSave(pk.trim())) setPk("");
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <p className={`${light ? "text-gray-600" : "text-gray-400"} text-sm`}>
        To take cards right here in LBC Auto, add your {mode} publishable key from the same Stripe API keys page.
      </p>
      <div className="flex gap-2">
        <Input autoComplete="off" spellCheck={false} data-no-capitalize aria-label="Stripe publishable key" value={pk} onChange={(e) => setPk(e.target.value)}
          placeholder={`e.g. pk_${mode}_...`} className="bg-gray-800 border-gray-700 text-white" />
        <Button type="submit" size="sm" disabled={busy || !pk.trim()} className="bg-sky-500 hover:bg-sky-600 gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}