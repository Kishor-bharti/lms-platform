import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  return children;
}

export function RoleBasedRoute({ children, allowedRoles }) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const role = typeof window !== "undefined" ? window.localStorage.getItem("role") : null;
  
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/admin/index" replace />;
  }
  
  return children;
}
