import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileDocumentView from "@/components/customers/ProfileDocumentView";
import { describeDocument } from "@/lib/customerDocuments";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
// A Radix dialog/menu opened from the editor portals outside this layer and handles its own keys.
const nestedLayerOpen = () => !!document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]');

// The full original editor, opened above the customer profile (full screen on phones).
// The profile stays mounted underneath, so its tab, data and scroll are untouched.
export default function ProfileDocumentLayer({ doc, customerId, customerName, openDoc, closeDoc }) {
  const panel = useRef(null);
  const label = describeDocument(doc.type, { id: doc.id }).label;

  useEffect(() => {
    const restore = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.body.style.overflow = overflow; restore?.focus?.(); };
  }, []);

  const onKeyDown = (e) => {
    if (nestedLayerOpen() || e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (window.confirm("Close this document and return to the customer profile? Unsaved changes will be lost.")) closeDoc();
    }
    if (e.key === "Tab") {
      const nodes = [...panel.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={`${label} For ${customerName || "Customer"}`} onKeyDown={onKeyDown}>
      {/* Backdrop never dismisses: closing is always explicit so edits are not lost. */}
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      <div ref={panel} tabIndex={-1} className="lbc-dvh-screen relative mx-auto flex w-full min-w-0 flex-col bg-gray-950 shadow-2xl outline-none lg:w-[calc(100%-2rem)] lg:max-w-[1280px] lg:border-x lg:border-gray-800" data-lbc-profile-layer="">
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-800 px-3 py-2 md:px-6" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <Button variant="ghost" size="sm" onClick={() => closeDoc()} className="min-h-[44px] gap-2 text-gray-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back To {customerName || "Customer"}
          </Button>
          <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-6">
          <ProfileDocumentView doc={doc} customerId={customerId} openDoc={openDoc} closeDoc={closeDoc} />
        </div>
      </div>
    </div>,
    document.body
  );
}