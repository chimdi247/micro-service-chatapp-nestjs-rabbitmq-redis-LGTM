import { apiClient } from "@/lib/api-client";
import type { Conversation, Message } from "@/lib/types";

export interface CreateConversationPayload {
  title?: string;
  participantIds: string[];
}

export const conversationsApi = {
  async list(): Promise<Conversation[]> {
    const response = await apiClient.get<{ data: Conversation[] }>("/conversations");
    return response.data.data;
  },

  async get(id: string): Promise<Conversation> {
    const response = await apiClient.get<{ data: Conversation }>(`/conversations/${id}`);
    return response.data.data;
  },

  async create(payload: CreateConversationPayload): Promise<Conversation> {
    const response = await apiClient.post<{ data: Conversation }>("/conversations", payload);
    return response.data.data;
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    const response = await apiClient.get<{ data: Message[] }>(
      `/conversations/${conversationId}/messages`,
    );
    // The API returns newest-first; the UI wants oldest-first.
    return [...response.data.data].reverse();
  },

  async sendMessage(conversationId: string, body: string): Promise<Message> {
    const response = await apiClient.post<{ data: Message }>(
      `/conversations/${conversationId}/messages`,
      { body },
    );
    return response.data.data;
  },
};
