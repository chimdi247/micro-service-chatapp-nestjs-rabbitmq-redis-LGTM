import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@/lib/types";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  getDisplayName: (id: string) => string;
}

export const MessageList = ({ messages, currentUserId, getDisplayName }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-3 p-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              body={message.body}
              senderName={getDisplayName(message.senderId)}
              createdAt={message.createdAt}
              isOwnMessage={message.senderId === currentUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
};
