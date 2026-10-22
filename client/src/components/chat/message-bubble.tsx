import { UserAvatar } from "@/components/chat/user-avatar";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  body: string;
  senderName: string;
  createdAt: string;
  isOwnMessage: boolean;
}

const formatTime = (isoDate: string): string => {
  try {
    return new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export const MessageBubble = ({ body, senderName, createdAt, isOwnMessage }: MessageBubbleProps) => {
  return (
    <div className={cn("flex items-end gap-2", isOwnMessage && "flex-row-reverse")}>
      {!isOwnMessage ? <UserAvatar name={senderName} className="h-7 w-7 text-[10px]" /> : null}
      <div className={cn("flex max-w-[70%] flex-col", isOwnMessage && "items-end")}>
        {!isOwnMessage ? <span className="mb-0.5 px-1 text-xs text-muted-foreground">{senderName}</span> : null}
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
            isOwnMessage
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-secondary text-secondary-foreground",
          )}
        >
          {body}
        </div>
        <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{formatTime(createdAt)}</span>
      </div>
    </div>
  );
};
