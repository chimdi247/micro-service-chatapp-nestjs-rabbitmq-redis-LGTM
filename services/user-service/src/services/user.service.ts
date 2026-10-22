import type { UserRepository } from '@/repositories/user.repositories';
import type { CreateUserInput, User } from '@/types/user';

import { sequelize } from '@/db';
import { userRepository } from '@/repositories/user.repositories';
import { AuthUserRegisteredPayload, HttpError, withSpan } from '@chatapp/common';
import { UniqueConstraintError } from 'sequelize';
import { publishUserCreatedEvent } from '@/messaging/event-publisher';

class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getUserById(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return this.repository.findAll();
  }

  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.repository.create(input);

      void publishUserCreatedEvent({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });

      return user;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new HttpError(409, 'User already exists');
      }
      throw error;
    }
  }

  async searchUsers(params: {
    query: string;
    limit?: number;
    excludeIds?: string[];
  }): Promise<User[]> {
    const query = params.query.trim();
    if (query.length === 0) {
      return [];
    }

    return withSpan(
      'user.search',
      () =>
        this.repository.searchByQuery(query, {
          limit: params.limit,
          excludeIds: params.excludeIds,
        }),
      { attributes: { 'search.query_length': query.length } },
    );
  }

  async syncFromAuthUser(payload: AuthUserRegisteredPayload): Promise<User> {
    return withSpan(
      'user.sync_from_auth',
      async () => {
        const user = await this.repository.upsertFromAuthEvent(payload);

        void publishUserCreatedEvent({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
        return user;
      },
      { attributes: { 'user.id': payload.id, 'chatapp.flow': 'user-sync' } },
    );
  }
}

export const userService = new UserService(userRepository);
