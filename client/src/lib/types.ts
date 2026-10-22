export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface Reaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  reactions: Reaction[];
}

export interface ApiErrorPayload {
  message: string;
  details?: Record<string, unknown>;
}
