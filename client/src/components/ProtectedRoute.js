import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  return children;
}
