import type { AuthTokens } from "@/lib/types";

const STORAGE_KEY = "chatapp.tokens";

export const tokenStorage = {
  get(): AuthTokens | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthTokens;
    } catch {
      return null;
    }
  },

  set(tokens: AuthTokens): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
