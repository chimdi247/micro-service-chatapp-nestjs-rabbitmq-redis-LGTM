import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";
import type { User } from "@/lib/types";
import { usersApi } from "@/lib/users-api";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (participantIds: string[], title?: string) => Promise<void>;
}

export const NewConversationDialog = ({ open, onOpenChange, onCreate }: NewConversationDialogProps) => {
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected([]);
      setTitle("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    const excludeIds = user ? [user.id, ...selected.map((person) => person.id)] : [];
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      usersApi
        .search(query, excludeIds)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false));
    }, 300);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user]);

  const toggleSelected = (person: User) => {
    setSelected((current) => {
      const alreadySelected = current.some((item) => item.id === person.id);
      if (alreadySelected) {
        return current.filter((item) => item.id !== person.id);
      }
      return [...current, person];
    });
    setResults((current) => current.filter((item) => item.id !== person.id));
    setQuery("");
  };

  const removeSelected = (personId: string) => {
    setSelected((current) => current.filter((item) => item.id !== personId));
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      setError("Pick at least one person to chat with.");
      return;
    }

    setError(null);
    setIsCreating(true);
    try {
      await onCreate(
        selected.map((person) => person.id),
        title.trim() || undefined,
      );
      onOpenChange(false);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Could not start the conversation."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new conversation</DialogTitle>
          <DialogDescription>
            Search for people by name or email. Pick one for a direct message, or several to
            start a group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => removeSelected(person.id)}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
                >
                  {person.displayName}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}

          {selected.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="group-title">Group name (optional)</Label>
              <Input
                id="group-title"
                placeholder="e.g. Project team"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="search-users">Search people</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-users"
                placeholder="Type at least 3 characters..."
                className="pl-8"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {isSearching ? (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          {results.length > 0 ? (
            <div className="max-h-48 space-y-1 overflow-y-auto thin-scrollbar">
              {results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggleSelected(person)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm hover:bg-accent"
                >
                  <UserAvatar name={person.displayName} className="h-8 w-8 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{person.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating || selected.length === 0}>
            {isCreating ? "Starting..." : "Start conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
