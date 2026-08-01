import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OwnershipActionConfirmDialog({ action, busy, onCancel, onConfirm }) {
  useEffect(() => {
    if (!action) return;
    const block = (event) => { if (event.key === "Escape") event.preventDefault(); };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [action]);
  if (!action) return null;
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-amber-500/30 bg-gray-950 p-6"><h3 className="text-lg font-bold text-white">{action.title}</h3><p className="mt-2 text-sm text-gray-300">{action.description}</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><Button onClick={onConfirm} disabled={busy} className="bg-sky-600 hover:bg-sky-500">Confirm</Button></div></div></div>;
}