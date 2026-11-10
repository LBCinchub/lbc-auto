import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { TEXT_FINAL } from "./deliveryUi";

const errOf = (e) => e?.response?.data?.error || e?.message || "Something went wrong";

// Preview, explicit send, resume of definitely-failed parts, and status polling for "Send As Text".
export default function useDocumentText(documentType, documentId) {
  const [info, setInfo] = useState(null);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const keyRef = useRef(crypto.randomUUID());   // one per window: repeats never resend
  const call = (payload) => base44.functions.invoke("sendDocumentText", { document_type: documentType, document_id: documentId, ...payload });

  useEffect(() => {
    call({ action: "prepare" })
      .then((r) => { setInfo({ ...r.data, this_window_key: keyRef.current }); setGroup(r.data.latest); })
      .catch((e) => setError(errOf(e)));
  }, [documentType, documentId]);

  const moving = group?.parts?.some((p) => !TEXT_FINAL.includes(p.status));
  useEffect(() => {
    if (!group?.group_key || !moving) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const r = await call({ action: "status", group_key: group.group_key }).catch(() => null);
      if (r?.data?.group) setGroup(r.data.group);
      if (tries >= 36) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [group?.group_key, moving]);

  const run = useCallback(async (resume) => {
    setError("");
    setSending(true);
    try {
      const r = await call({ action: "send", idempotency_key: keyRef.current, preview_sha256: info?.preview_sha256, resume });
      setGroup(r.data.group);
    } catch (e) {
      setError(errOf(e));
      if (e?.response?.data?.group) setGroup(e.response.data.group);
    } finally {
      setSending(false);
    }
  }, [documentType, documentId, info?.preview_sha256]);

  return { info, group, error, sending, send: () => run(false), resume: () => run(true) };
}