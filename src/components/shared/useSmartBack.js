import { useLocation, useNavigate } from "react-router-dom";
import { hasInAppHistory, safeReturnTo } from "@/lib/customerDocuments";

/**
 * Returns a smart "go back" handler.
 * Goes one step back when there is an earlier in-app page; otherwise (direct URL)
 * returns to the remembered in-app origin, or `fallbackTo`.
 */
export function useSmartBack(fallbackTo = "/") {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (hasInAppHistory()) navigate(-1);
    else navigate(safeReturnTo(location.state?.returnTo) || fallbackTo, { replace: true });
  };
}