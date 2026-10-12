import { useEffect, useState } from "react";

// True while a full-screen financial editor (new invoice/estimate) is mounted.
export default function useFinancialShellOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector("[data-lbc-financial-shell]"));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return open;
}