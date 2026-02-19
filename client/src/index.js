import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import ProtectedRoute from "components/ProtectedRoute.js";

import "assets/plugins/nucleo/css/nucleo.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "assets/scss/argon-dashboard-react.scss";

import AdminLayout from "layouts/Admin.js";
import AuthLayout  from "layouts/Auth.js";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <Routes>
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/*" element={<AuthLayout />} />
      {/* FIX: use "accessToken" (matches what login pages store) */}
      <Route
        path="*"
        element={
          window.localStorage.getItem("accessToken")
            ? <Navigate to="/admin/index" replace />
            : <Navigate to="/auth/login" replace />
        }
      />
    </Routes>
  </BrowserRouter>
);
