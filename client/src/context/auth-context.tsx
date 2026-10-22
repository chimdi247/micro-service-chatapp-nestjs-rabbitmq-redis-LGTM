import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi, type LoginPayload, type RegisterPayload } from "@/lib/auth-api";
import { decodeAccessToken } from "@/lib/jwt";
import { tokenStorage } from "@/lib/token-storage";
import type { User } from "@/lib/types";
import { usersApi } from "@/lib/users-api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfileFromStoredToken = useCallback(async () => {
    const tokens = tokenStorage.get();
    if (!tokens?.accessToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const claims = decodeAccessToken(tokens.accessToken);
    if (!claims?.sub) {
      tokenStorage.clear();
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await usersApi.getById(claims.sub);
      setUser(profile);
    } catch {
      // The api-client's response interceptor already tried a silent
      // refresh (and clears storage + fires "chatapp:logout" if that
      // failed too), so here we just reflect that there's no session.
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfileFromStoredToken();

    const handleLogout = () => setUser(null);
    window.addEventListener("chatapp:logout", handleLogout);
    return () => window.removeEventListener("chatapp:logout", handleLogout);
  }, [loadProfileFromStoredToken]);

  const login = useCallback(async (payload: LoginPayload) => {
    const tokens = await authApi.login(payload);
    tokenStorage.set(tokens);
    await loadProfileFromStoredToken();
  }, [loadProfileFromStoredToken]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await authApi.register(payload);
    tokenStorage.set({ accessToken: response.accessToken, refreshToken: response.refreshToken });
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    const currentUserId = user?.id;
    tokenStorage.clear();
    setUser(null);
    if (currentUserId) {
      // Best-effort; the user is logged out client-side regardless of
      // whether this network call succeeds.
      void authApi.revoke(currentUserId).catch(() => undefined);
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
