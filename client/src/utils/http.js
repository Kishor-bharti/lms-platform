import axios from "axios";
import { API_BASE } from "./api";

const http = axios.create({
  baseURL: API_BASE || undefined,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach accessToken (not "token") to every request
http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("accessToken");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

// Only redirect on 401 for NON-login routes
// Login pages handle their own errors via catch blocks
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url ?? "";
    const isAuthRoute = url.includes("/auth/login");

    if (status === 401 && !isAuthRoute && typeof window !== "undefined") {
      window.localStorage.removeItem("accessToken");
      window.localStorage.removeItem("refreshToken");
      window.localStorage.removeItem("role");
      window.localStorage.removeItem("user");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

export default http;
