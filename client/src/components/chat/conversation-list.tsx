import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { ConversationItem } from "@/components/chat/conversation-item";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getConversationDisplayName } from "@/lib/conversation-display";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  currentUserId: string;
  getDisplayName: (id: string) => string;
  onNewConversation: () => void;
}

export const ConversationList = ({
  conversations,
  activeConversationId,
  currentUserId,
  getDisplayName,
  onNewConversation,
}: ConversationListProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <Button size="icon" variant="secondary" onClick={onNewConversation} title="New conversation">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No conversations yet. Start one!
            </p>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                name={getConversationDisplayName(conversation, currentUserId, getDisplayName)}
                preview={conversation.lastMessagePreview}
                isActive={conversation.id === activeConversationId}
                isGroup={conversation.participantIds.length > 2}
                onClick={() => navigate(`/chat/${conversation.id}`)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
