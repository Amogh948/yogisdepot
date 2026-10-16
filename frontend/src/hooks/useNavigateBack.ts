import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Returns to the previous portal page/state when possible.
 * Falls back when this is the first history entry (e.g. opened in a new tab).
 */
export function useNavigateBack(fallback = "/") {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (location.key !== "default") {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [fallback, location.key, navigate]);
}
