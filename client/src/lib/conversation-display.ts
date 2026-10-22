import type { Conversation } from "@/lib/types";

export const getOtherParticipantIds = (conversation: Conversation, currentUserId: string): string[] =>
  conversation.participantIds.filter((id) => id !== currentUserId);

export const getConversationDisplayName = (
  conversation: Conversation,
  currentUserId: string,
  getDisplayName: (id: string) => string,
): string => {
  if (conversation.title) {
    return conversation.title;
  }

  const otherIds = getOtherParticipantIds(conversation, currentUserId);

  if (otherIds.length === 0) {
    return "Just you";
  }

  return otherIds.map((id) => getDisplayName(id)).join(", ");
};
