import axios from "axios";
import { API_BASE } from "./api";

export function getTokenExpiresInSeconds() {
  try {
    const token = window.localStorage.getItem('accessToken');
    if (!token) return 0;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}

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

// Helper to clear all auth data and redirect to login
const clearAuthAndRedirect = () => {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem("role");
  window.localStorage.removeItem("user");
  window.location.href = "/auth/login";
};

// Response interceptor with token refresh logic
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const url = originalRequest?.url ?? "";
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/refresh");

    // Only attempt refresh on 401 for non-auth routes
    if (status === 401 && !isAuthRoute && typeof window !== "undefined") {
      // Prevent infinite retry loops
      if (originalRequest._retry) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Use the shared silentRefresh to avoid race conditions
      // when multiple 401s fire at the same time
      const newToken = await silentRefresh();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
      }

      // Refresh failed — clear auth and redirect
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// ─── Proactive silent token refresh ────────────────────────────
// Checks every 30s. If access token has <2min left, silently
// refresh in the background so it never actually expires.
let _refreshingPromise = null;

export async function silentRefresh() {
  if (_refreshingPromise) return _refreshingPromise; // deduplicate

  const refreshToken = window.localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  _refreshingPromise = axios
    .post(
      `${API_BASE || ''}/api/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    )
    .then((res) => {
      const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
      window.localStorage.setItem('accessToken', newAccess);
      window.localStorage.setItem('refreshToken', newRefresh);
      return newAccess;
    })
    .catch(() => null)
    .finally(() => {
      _refreshingPromise = null;
    });

  return _refreshingPromise;
}

// Start the proactive refresh loop (only in browser)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const secs = getTokenExpiresInSeconds();
    // If token exists and has <2min left, refresh proactively
    if (secs > 0 && secs <= 120) {
      silentRefresh();
    }
  }, 30_000);
}

export default http;
