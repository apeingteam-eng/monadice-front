import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://monadice-backend.onrender.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

// 🔒 Interceptor to attach JWT token (if exists)
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  // ✅ Ensure headers object always exists
  if (!config.headers) {
    config.headers = {};
  }

  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

export default api;
