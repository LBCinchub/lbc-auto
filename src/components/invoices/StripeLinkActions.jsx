import React, { useRef, useState } from "react";
import { Copy, ExternalLink, Loader2, MessageSquare, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const BTN = "h-8 gap-1.5 border-gray-700 px-2.5 text-xs";

// Share, check and cancel an open card payment link.
export default function StripeLinkActions({ link, busy, customerPhone, onCheck, onCancel }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [note, setNote] = useState("");
  const amount = `$${Number(link.amount || 0).toFixed(2)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setNote("Link copied.");
    } catch {
      inputRef.current?.select();
      setNote("Link selected. Copy it from the box above.");
    }
  };

  const text = async () => {
    setNote("Sending text…");
    const shop = user?.business_name ? `${user.business_name}: ` : "";
    try {
      await base44.functions.invoke("sendSMS", { phone: customerPhone, message: `${shop}Pay invoice ${link.invoice_number} (${amount}) securely by card: ${link.url}` });
      setNote("Payment link texted to the customer.");
    } catch (e) {
      setNote(e?.response?.data?.error || "The text could not be sent.");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Waiting for <b className="text-white">{amount} {link.currency}</b>. The link works for 24 hours.</p>
      <input ref={inputRef} readOnly value={link.url} onFocus={(e) => e.target.select()} data-no-capitalize aria-label="Card payment link" className="h-8 w-full rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-300" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className={BTN} onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy</Button>
        <Button size="sm" variant="outline" className={BTN} asChild>
          <a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
        </Button>
        {customerPhone && <Button type="button" size="sm" variant="outline" className={BTN} onClick={text}><MessageSquare className="h-3.5 w-3.5" /> Send Payment Link</Button>}
        <Button type="button" size="sm" variant="outline" className={BTN} onClick={onCheck} disabled={!!busy}>
          {busy === "link_status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check payment
        </Button>
        <Button type="button" size="sm" variant="outline" className={`${BTN} text-rose-400 hover:text-rose-300`} onClick={onCancel} disabled={!!busy}>
          {busy === "cancel_link" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Cancel link
        </Button>
      </div>
      {note && <p className="text-xs text-sky-400">{note}</p>}
    </div>
  );
}