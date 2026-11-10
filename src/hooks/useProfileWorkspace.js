import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { DOC_TYPES } from "@/lib/customerDocuments";

// URL-backed state for the staff customer profile: active tab plus the document
// opened inside the profile (?doc=invoice&docId=...). Survives refresh, back/forward.
export default function useProfileWorkspace(customerId, onClosed) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "estimates";
  const rawType = searchParams.get("doc");
  const docId = searchParams.get("docId");
  const doc = DOC_TYPES.includes(rawType) && docId ? { type: rawType, id: docId } : null;
  const scrollKey = `lbc_profile_scroll:${customerId}`;

  const update = (fn, opts) => setSearchParams((p) => { const n = new URLSearchParams(p); fn(n); return n; }, opts);
  const setTab = (t) => update((n) => n.set("tab", t), { replace: true });

  const openDoc = (type, id) => {
    if (!DOC_TYPES.includes(type) || !id) return;
    if (!doc) sessionStorage.setItem(scrollKey, String(window.scrollY));
    update((n) => { n.set("doc", type); n.set("docId", id); }, { state: { profileDoc: true } });
  };

  // Back to the profile: real history step when we opened it, otherwise drop the doc params.
  const closeDoc = (toTab) => {
    if (location.state?.profileDoc && !toTab) return navigate(-1);
    update((n) => { n.delete("doc"); n.delete("docId"); if (toTab) n.set("tab", toTab); }, { replace: true });
  };

  const docKey = doc ? `${doc.type}:${doc.id}` : "";
  const prevKey = useRef(docKey);
  useLayoutEffect(() => {
    if (docKey && docKey !== prevKey.current) window.scrollTo(0, 0);
    if (!docKey && prevKey.current) {
      window.scrollTo(0, Number(sessionStorage.getItem(scrollKey)) || 0);
      onClosed?.();
    }
    prevKey.current = docKey;
  }, [docKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tab, setTab, doc, openDoc, closeDoc };
}