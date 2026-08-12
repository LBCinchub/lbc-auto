import { useNavigate } from "react-router-dom";

/**
 * Returns a smart "go back" handler.
 * Goes one step back in browser history; if there's no previous entry
 * (user landed directly via URL), falls back to `fallbackTo`.
 */
export function useSmartBack(fallbackTo = "/") {
  const navigate = useNavigate();
  return () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(fallbackTo);
  };
}