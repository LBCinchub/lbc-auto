import { useLocation, useNavigate } from "react-router-dom";
import { hasInAppHistory, safeReturnTo } from "@/lib/customerDocuments";
import { useProfileDocument } from "@/components/customers/ProfileDocumentContext";

/**
 * Returns a smart "go back" handler.
 * Inside a customer profile document it closes the document back to the profile.
 * Otherwise goes one step back when there is an earlier in-app page; on a direct
 * URL it returns to the remembered in-app origin, or `fallbackTo`.
 */
export function useSmartBack(fallbackTo = "/") {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useProfileDocument();
  return () => {
    if (profile) return profile.closeDoc();
    if (hasInAppHistory()) navigate(-1);
    else navigate(safeReturnTo(location.state?.returnTo) || fallbackTo, { replace: true });
  };
}