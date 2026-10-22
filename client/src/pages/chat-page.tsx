import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LogOut, MessageCircle } from "lucide-react";

import { ConversationList } from "@/components/chat/conversation-list";
import { MessageComposer } from "@/components/chat/message-composer";
import { MessageList } from "@/components/chat/message-list";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { UserAvatar } from "@/components/chat/user-avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { useUserDirectory } from "@/context/user-directory-context";
import { getConversationDisplayName } from "@/lib/conversation-display";
import { conversationsApi } from "@/lib/conversations-api";
import type { Conversation, Message } from "@/lib/types";

const CONVERSATIONS_POLL_MS = 5000;
const MESSAGES_POLL_MS = 3000;

export const ChatPage = () => {
  const { user, logout } = useAuth();
  const { ensureUsers, getDisplayName } = useUserDirectory();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId),
    [conversations, conversationId],
  );

  // Poll the conversation list.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await conversationsApi.list();
        if (cancelled) {
          return;
        }
        setConversations(data);
        void ensureUsers(data.flatMap((conversation) => conversation.participantIds));
      } catch {
        // Transient network/API errors are ignored here; the next poll
        // tick will retry.
      }
    };

    void load();
    const intervalId = window.setInterval(load, CONVERSATIONS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll messages for the active conversation.
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const load = async (showSpinner: boolean) => {
      if (showSpinner) {
        setIsLoadingMessages(true);
      }
      try {
        const data = await conversationsApi.listMessages(conversationId);
        if (cancelled) {
          return;
        }
        setMessages(data);
        void ensureUsers(data.map((message) => message.senderId));
      } catch {
        // Ignored; retried on the next poll tick.
      } finally {
        if (showSpinner && !cancelled) {
          setIsLoadingMessages(false);
        }
      }
    };

    void load(true);
    const intervalId = window.setInterval(() => load(false), MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!conversationId) {
        return;
      }
      const message = await conversationsApi.sendMessage(conversationId, body);
      setMessages((current) => [...current, message]);
    },
    [conversationId],
  );

  const handleCreateConversation = useCallback(
    async (participantIds: string[], title?: string) => {
      const conversation = await conversationsApi.create({ participantIds, title });
      setConversations((current) => [conversation, ...current]);
      navigate(`/chat/${conversation.id}`);
    },
    [navigate],
  );

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MessageCircle className="h-4 w-4" />
          </div>
          <span className="font-semibold">ChatApp</span>
        </div>

        <div className="min-h-0 flex-1">
          <ConversationList
            conversations={conversations}
            activeConversationId={conversationId}
            currentUserId={user.id}
            getDisplayName={getDisplayName}
            onNewConversation={() => setIsDialogOpen(true)}
          />
        </div>

        <Separator />
        <div className="flex items-center gap-3 p-4">
          <UserAvatar name={user.displayName} className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={logout} title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <div className="flex items-center gap-3 border-b p-4">
              <UserAvatar
                name={getConversationDisplayName(activeConversation, user.id, getDisplayName)}
              />
              <div>
                <p className="text-sm font-semibold">
                  {getConversationDisplayName(activeConversation, user.id, getDisplayName)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeConversation.participantIds.length} participant
                  {activeConversation.participantIds.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {isLoadingMessages && messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Loading messages...
              </div>
            ) : (
              <MessageList messages={messages} currentUserId={user.id} getDisplayName={getDisplayName} />
            )}

            <MessageComposer onSend={handleSend} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Select a conversation, or start a new one.</p>
          </div>
        )}
      </main>

      <NewConversationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreate={handleCreateConversation}
      />
    </div>
  );
};
