import { UserAvatar } from "@/components/chat/user-avatar";
import { cn } from "@/lib/utils";

interface ConversationItemProps {
  name: string;
  preview: string | null;
  isActive: boolean;
  isGroup: boolean;
  onClick: () => void;
}

export const ConversationItem = ({ name, preview, isActive, isGroup, onClick }: ConversationItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-accent",
        isActive && "bg-accent",
      )}
    >
      <UserAvatar name={isGroup ? "Group" : name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{preview ?? "No messages yet"}</p>
      </div>
    </button>
  );
};
