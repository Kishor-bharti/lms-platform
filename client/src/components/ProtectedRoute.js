import { Navigate } from "react-router-dom";
import { useAuth } from 'context/AuthContext';

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
  const { token, role } = useAuth();

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  const roleRedirect = () => {
    if (role === 'admin')   return '/admin/admin-overview';
    if (role === 'teacher') return '/admin/sessions';
    return '/admin/index';  // student default
  };

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(role)) {
      return <Navigate to={roleRedirect()} replace />;
    }
  }

  return children;
}
