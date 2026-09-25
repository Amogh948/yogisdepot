import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import type { UserRole } from "../types";

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, bootstrapped } = useAuthStore();
  const location = useLocation();

  if (!bootstrapped) {
    return <div className="p-8 text-center text-sm text-charcoal-700">Loading your session…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { user, bootstrapped } = useAuthStore();
  if (!bootstrapped) return null;
  if (user?.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === "vendor") return <Navigate to="/vendor/dashboard" replace />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
