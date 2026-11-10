import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { pickupSendState } from "@/lib/pickupTextState";

const errOf = (e) => e?.response?.data?.error || e?.message || "Something Went Wrong";
const newKey = () => crypto.randomUUID();

// Preview (read-only), explicit send, explicit retry and status polling. Text edits stay local.
export default function usePickupText(orderId, onSent) {
  const [info, setInfo] = useState(null);
  const [body, setBody] = useState("");
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [windowKey, setWindowKey] = useState(newKey);
  const sentBody = useRef("");
  const call = (payload) => base44.functions.invoke("sendPickupText", { repair_order_id: orderId, ...payload });

  useEffect(() => {
    call({ action: "prepare" })
      .then((r) => { setInfo(r.data); setBody(r.data.template || ""); setGroup(r.data.latest); })
      .catch((e) => setError(errOf(e)));
  }, [orderId]);

  const state = pickupSendState({ info, group, windowKey, body, sentBody: sentBody.current, sending });

  useEffect(() => {
    if (!group?.group_key || !state.moving) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const r = await call({ action: "status", group_key: group.group_key }).catch(() => null);
      if (r?.data?.group) setGroup(r.data.group);
      if (tries >= 36) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [group?.group_key, state.moving]);

  const run = useCallback(async (resume) => {
    const key = !resume && state.freshKey ? newKey() : windowKey;
    if (key !== windowKey) setWindowKey(key);
    const text = resume ? sentBody.current : body;
    setError("");
    setSending(true);
    try {
      const r = await call({ action: "send", idempotency_key: key, body: text, resume });
      sentBody.current = text;
      setGroup(r.data.group);
      if (r.data.group?.accepted > 0) onSent?.();
    } catch (e) {
      setError(errOf(e));
    } finally {
      setSending(false);
    }
  }, [body, windowKey, state.freshKey, orderId]);

  return { info, body, setBody, group, error, sending, state, windowKey, send: () => run(false), retry: () => run(true) };
}