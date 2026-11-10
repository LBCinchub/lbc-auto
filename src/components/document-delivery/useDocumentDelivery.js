import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const FINAL = ["delivered", "undelivered", "failed", "canceled"];
const errOf = (e) => e?.response?.data?.error || e?.message || "Something went wrong";

// Preview, explicit send and status polling for one saved estimate/invoice PDF text.
export default function useDocumentDelivery(documentType, documentId) {
  const [info, setInfo] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const keyRef = useRef(crypto.randomUUID());   // one per open window: repeats never resend
  const call = (payload) => base44.functions.invoke("sendDocumentPdf", { document_type: documentType, document_id: documentId, ...payload });

  useEffect(() => {
    call({ action: "prepare" }).then((r) => { setInfo(r.data); setDelivery(r.data.latest); }).catch((e) => setError(errOf(e)));
  }, [documentType, documentId]);

  // Follow Twilio's status for up to ~3 minutes while the message is moving.
  useEffect(() => {
    if (!delivery?.id || FINAL.includes(delivery.status)) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const r = await call({ action: "status", delivery_id: delivery.id }).catch(() => null);
      if (r?.data?.delivery) setDelivery(r.data.delivery);
      if (tries >= 36) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [delivery?.id, delivery?.status]);

  const send = useCallback(async () => {
    setError("");
    setSending(true);
    try {
      const r = await call({ action: "send", idempotency_key: keyRef.current });
      setDelivery(r.data.delivery);
    } catch (e) {
      setError(errOf(e));
      if (e?.response?.data?.delivery) setDelivery(e.response.data.delivery);
    } finally {
      setSending(false);
    }
  }, [documentType, documentId]);

  return { info, delivery, error, sending, send };
}