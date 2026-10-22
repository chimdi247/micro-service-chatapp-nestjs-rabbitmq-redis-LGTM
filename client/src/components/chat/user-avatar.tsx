import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

interface UserAvatarProps {
  name: string;
  className?: string;
}

export const UserAvatar = ({ name, className }: UserAvatarProps) => {
  return (
    <Avatar className={cn(className)}>
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
};
