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

      // Get refresh token from storage
      const refreshToken = window.localStorage.getItem("refreshToken");
      if (!refreshToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        // Use plain axios (not http instance) to avoid infinite loops
        const refreshResponse = await axios.post(
          `${API_BASE || ""}/api/auth/refresh`,
          { refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          refreshResponse.data;

        // Store new tokens
        window.localStorage.setItem("accessToken", newAccessToken);
        window.localStorage.setItem("refreshToken", newRefreshToken);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return http(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear auth and redirect to login
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default http;
