import api from "@/config/api";

/**
 * Represents the structure of the authenticated user data
 * returned by the /auth/me endpoint.
 */
export interface UserMeResponse {
  username: string;
  wallet_address: string;
  // Add other fields if your backend returns them, e.g.:
  // email?: string;
  // created_at?: string;
}

/**
 * Fetches the current authenticated user's profile.
 * Automatically includes the Authorization header
 * via the axios interceptor in api.ts.
 */
export async function getMe(): Promise<UserMeResponse> {
  const response = await api.get<UserMeResponse>("/auth/me");
  return response.data;
}

/**
 * Returns authorization headers manually (for fetch-based calls).
 * Matches the same token logic used by api.ts interceptor.
 */
export async function getAuthHeader() {
  if (typeof window === "undefined") {
    throw new Error("getAuthHeader() called on the server side.");
  }

  // ✅ Consistent with api.ts (uses "access_token")
  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    null;

  if (!token) {
    throw new Error("No access token found. Please log in again.");
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}
