import { apiClient } from "@/lib/api-client";
import type { User } from "@/lib/types";

export const usersApi = {
  async getById(id: string): Promise<User> {
    const response = await apiClient.get<{ data: User }>(`/users/${id}`);
    return response.data.data;
  },

  async listAll(): Promise<User[]> {
    const response = await apiClient.get<{ data: User[] }>("/users");
    return response.data.data;
  },

  async search(query: string, excludeIds: string[] = []): Promise<User[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      return [];
    }
    const response = await apiClient.get<{ data: User[] }>("/users/search", {
      params: {
        query: trimmed,
        ...(excludeIds.length > 0 ? { exclude: excludeIds } : {}),
      },
    });
    return response.data.data;
  },
};
