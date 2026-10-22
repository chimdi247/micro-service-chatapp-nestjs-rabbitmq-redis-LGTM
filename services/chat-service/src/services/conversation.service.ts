import { HttpError, appMetrics, withSpan } from '@chatapp/common';
import type {
  Conversation,
  ConversationFilter,
  ConversationSummary,
  CreateConversationInput,
} from '@/types/conversation';

import { conversationCache } from '@/cache/conversation.cache';
import { conversationRepository } from '@/repositories/conversation.repository';

export const conversationService = {
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    return withSpan(
      'chat.conversation.create',
      async (span) => {
        const conversation = await conversationRepository.create(input);
        await conversationCache.set(conversation);
        span.setAttribute('conversation.id', conversation.id);
        appMetrics.conversationsCreated.add(1, {
          type: input.participantIds.length > 2 ? 'group' : 'direct',
        });
        return conversation;
      },
      { attributes: { 'conversation.participants': input.participantIds.length } },
    );
  },

  async getConversationById(id: string): Promise<Conversation> {
    const cached = await conversationCache.get(id);
    if (cached) {
      return cached;
    }

    const conversation = await conversationRepository.findById(id);
    if (!conversation) {
      throw new HttpError(404, 'Conversation not found');
    }

    await conversationCache.set(conversation);
    return conversation;
  },

  async listConversation(filter: ConversationFilter): Promise<ConversationSummary[]> {
    return conversationRepository.findSummaries(filter);
  },

  async touchConversation(conversationId: string, preview: string): Promise<void> {
    await conversationRepository.touchConversation(conversationId, preview);
    await conversationCache.delete(conversationId);
  },
};
