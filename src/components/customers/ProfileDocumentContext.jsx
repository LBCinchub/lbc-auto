import React, { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { matchDocumentPath, matchListPath } from "@/lib/customerDocuments";

// Present only while a document is open inside a staff customer profile.
// Lets the existing editors keep their own navigation code while the profile
// stays the navigation context: document links open in-profile, list/customer
// destinations return to the profile tab.
const ProfileDocumentCtx = createContext(null);

export function ProfileDocumentProvider({ value, children }) {
  return <ProfileDocumentCtx.Provider value={value}>{children}</ProfileDocumentCtx.Provider>;
}

export function useProfileDocument() {
  return useContext(ProfileDocumentCtx);
}

export function useDocumentNavigate() {
  const navigate = useNavigate();
  const profile = useContext(ProfileDocumentCtx);
  return useCallback((to, opts) => {
    if (profile && typeof to === "string") {
      const doc = matchDocumentPath(to);
      if (doc) return profile.openDoc(doc.type, doc.id);
      const list = matchListPath(to, profile.customerId);
      if (list) return profile.closeDoc(list.tab);
    }
    return navigate(to, opts);
  }, [navigate, profile]);
}