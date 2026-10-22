import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { tokenStorage } from "@/lib/token-storage";
import type { ApiErrorPayload } from "@/lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
});

// Every request (except the auth endpoints themselves, which don't
// need a bearer token) gets the current access token attached.
apiClient.interceptors.request.use((config) => {
  const tokens = tokenStorage.get();
  if (tokens?.accessToken) {
    config.headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  return config;
});

export const getApiErrorMessage = (error: unknown, fallback = "Something went wrong"): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    if (data?.message) {
      return data.message;
    }
  }
  return fallback;
};

// --- 401 handling: try exactly one silent refresh, then retry the
// original request. If the refresh itself fails, clear tokens and let
// the app redirect to /login (handled by ProtectedRoute reacting to
// the auth context, triggered via the "chatapp:logout" event below).

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshPromise: Promise<string | null> | null = null;

const requestNewAccessToken = async (): Promise<string | null> => {
  const tokens = tokenStorage.get();
  if (!tokens?.refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken: tokens.refreshToken },
    );
    tokenStorage.set(response.data);
    return response.data.accessToken;
  } catch {
    return null;
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest?.url?.startsWith("/auth/");

    if (status !== 401 || !originalRequest || originalRequest._retried || isAuthEndpoint) {
      throw error;
    }

    originalRequest._retried = true;

    if (!refreshPromise) {
      refreshPromise = requestNewAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      tokenStorage.clear();
      window.dispatchEvent(new Event("chatapp:logout"));
      throw error;
    }

    originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
    return apiClient.request(originalRequest);
  },
);
