import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { User } from "@/lib/types";
import { usersApi } from "@/lib/users-api";

interface UserDirectoryContextValue {
  users: Record<string, User>;
  ensureUsers: (ids: string[]) => Promise<void>;
  getDisplayName: (id: string) => string;
}

const UserDirectoryContext = createContext<UserDirectoryContextValue | undefined>(undefined);

export const UserDirectoryProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<Record<string, User>>({});
  // Tracks in-flight/completed lookups so we never request the same id
  // twice, independent of React's state batching.
  const requestedIds = useRef<Set<string>>(new Set());

  const ensureUsers = useCallback(async (ids: string[]) => {
    const idsToFetch = Array.from(new Set(ids)).filter((id) => !requestedIds.current.has(id));

    if (idsToFetch.length === 0) {
      return;
    }

    idsToFetch.forEach((id) => requestedIds.current.add(id));

    const results = await Promise.allSettled(idsToFetch.map((id) => usersApi.getById(id)));

    setUsers((previous) => {
      const next = { ...previous };
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          next[idsToFetch[index]] = result.value;
        } else {
          // Allow retrying later (e.g. transient network error) rather
          // than permanently treating this id as unresolvable.
          requestedIds.current.delete(idsToFetch[index]);
        }
      });
      return next;
    });
  }, []);

  const getDisplayName = useCallback(
    (id: string) => users[id]?.displayName ?? "Unknown user",
    [users],
  );

  return (
    <UserDirectoryContext.Provider value={{ users, ensureUsers, getDisplayName }}>
      {children}
    </UserDirectoryContext.Provider>
  );
};

export const useUserDirectory = (): UserDirectoryContextValue => {
  const context = useContext(UserDirectoryContext);
  if (!context) {
    throw new Error("useUserDirectory must be used within a UserDirectoryProvider");
  }
  return context;
};
