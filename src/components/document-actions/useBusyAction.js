import { useRef, useState } from "react";

// One action at a time per card: repeat clicks while a request is pending are ignored.
export default function useBusyAction() {
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);
  const runBusy = async (id, fn) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    try { return await fn(); } finally { lock.current = false; setBusyId(null); }
  };
  return { busyId, runBusy };
}