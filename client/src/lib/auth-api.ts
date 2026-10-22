import { apiClient } from "@/lib/api-client";
import type { AuthTokens, User } from "@/lib/types";

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterResponse extends AuthTokens {
  user: User;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>("/auth/register", payload);
    return response.data;
  },

  async login(payload: LoginPayload): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>("/auth/login", payload);
    return response.data;
  },

  async revoke(userId: string): Promise<void> {
    await apiClient.post("/auth/revoke", { userId });
  },
};
