import { Navigate } from "react-router-dom";

// Reads accessToken (matches what Login/AdminLogin store)
export default function ProtectedRoute({ children }) {
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("accessToken")
    : null;
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  return children;
}

// FIX: allowedRoles in routes.js are uppercase ("STUDENT","TEACHER")
// but backend returns lowercase ("student","teacher").
// We normalise both sides to lowercase for comparison.
export function RoleBasedRoute({ children, allowedRoles }) {
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("accessToken")
    : null;
  const role = typeof window !== "undefined"
    ? window.localStorage.getItem("role")
    : null;

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  const roleRedirect = () => {
    const r = (window.localStorage.getItem('role') || '').toLowerCase();
    if (r === 'admin')   return '/admin/admin-overview';
    if (r === 'teacher') return '/admin/sessions';
    return '/admin/index';  // student default
  };

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const normalizedRole    = (role ?? "").toLowerCase();
    if (!normalizedAllowed.includes(normalizedRole)) {
      return <Navigate to={roleRedirect()} replace />;
    }
  }

  return children;
}
