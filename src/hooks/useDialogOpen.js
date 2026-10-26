import { useEffect, useState } from "react";

// True while any dialog (New Estimate, payment, add customer…) other than the AI chat itself is open.
export default function useDialogOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(Array.from(
      document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
    ).some((el) => !el.closest("[data-lbc-ai-layer]")));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, []);
  return open;
}