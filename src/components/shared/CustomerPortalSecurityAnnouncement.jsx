import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "v20260731_customer_portal_security";

export default function CustomerPortalSecurityAnnouncement() {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!localStorage.getItem(KEY)) setOpen(true); }, []);
  useEffect(() => {
    if (!open) return;
    const blockEscape = (event) => { if (event.key === "Escape") event.preventDefault(); };
    window.addEventListener("keydown", blockEscape, true);
    return () => window.removeEventListener("keydown", blockEscape, true);
  }, [open]);
  if (!open) return null;
  const close = () => { localStorage.setItem(KEY, "seen"); setOpen(false); };
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl border border-sky-500/30 bg-gray-950 p-6 shadow-2xl"><ShieldCheck className="mb-3 h-9 w-9 text-sky-400" /><h2 className="text-xl font-bold text-white">Customer portal security update</h2><p className="mt-3 text-sm leading-6 text-gray-300">Existing customers are preserved. They must activate secure portal access with a one-time code and create a personal passcode before viewing records.</p><Button onClick={close} className="mt-6 w-full bg-sky-600 hover:bg-sky-500">Got it</Button></div></div>;
}