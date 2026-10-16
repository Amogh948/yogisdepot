import type { ReactNode } from "react";
import { BackLink } from "../navigation/BackLink";

/** @deprecated Prefer `BackLink` — same behavior for all portal roles. */
export function AdminBackLink({
  fallback = "/admin/dashboard",
  children = "Back",
  className = "text-sm font-semibold text-yd-muted",
}: {
  fallback?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <BackLink fallback={fallback} className={className}>
      {children}
    </BackLink>
  );
}
