import type { ReactNode } from "react";
import { useNavigateBack } from "../../hooks/useNavigateBack";

/** Control that returns to the previous portal page or a fallback path. */
export function BackLink({
  fallback = "/",
  children = "Back",
  className = "text-sm font-semibold text-yd-muted",
}: {
  fallback?: string;
  children?: ReactNode;
  className?: string;
}) {
  const goBack = useNavigateBack(fallback);
  return (
    <button type="button" className={className} onClick={goBack}>
      {children}
    </button>
  );
}
