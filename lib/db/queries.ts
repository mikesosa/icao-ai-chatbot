import 'server-only';

import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import type { ModelType } from '@/lib/types';

import { ChatSDKError } from '../errors';
import { generateUUID } from '../utils';

import {
  stream,
  type Chat,
  type DBMessage,
  type PartnerDiscount,
  type Subscription,
  type Suggestion,
  type User,
  chat,
  discountRedemption,
  document,
  message,
  partnerDiscount,
  subscription,
  suggestion,
  user,
  vote,
} from './schema';
import { generateHashedPassword } from './utils';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function getSubscriptionByUserId(
  userId: string,
): Promise<Subscription | null> {
  try {
    const [record] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, userId))
      .limit(1);
    return record ?? null;
  } catch (error: any) {
    if (typeof error?.message === 'string') {
      const message = error.message.toLowerCase();
      if (
        message.includes('relation "subscription" does not exist') ||
        message.includes('relation "subscription"')
      ) {
        console.warn(
          '⚠️ [DB] Subscription table missing. Run migrations to enable billing.',
        );
        return null;
      }
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get subscription by user id',
    );
  }
}

export async function upsertSubscriptionForUser({
  userId,
  status,
  planId,
  rebillCustomerId,
  rebillSubscriptionId,
  currentPeriodEnd,
}: {
  userId: string;
  status: string;
  planId?: string | null;
  rebillCustomerId?: string | null;
  rebillSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  const now = new Date();
  try {
    const existing = await getSubscriptionByUserId(userId);

    if (existing) {
      const [updated] = await db
        .update(subscription)
        .set({
          status,
          planId: planId ?? existing.planId,
          rebillCustomerId: rebillCustomerId ?? existing.rebillCustomerId,
          rebillSubscriptionId:
            rebillSubscriptionId ?? existing.rebillSubscriptionId,
          currentPeriodEnd:
            currentPeriodEnd ?? existing.currentPeriodEnd ?? null,
          updatedAt: now,
        })
        .where(eq(subscription.userId, userId))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(subscription)
      .values({
        userId,
        status,
        planId: planId ?? null,
        rebillCustomerId: rebillCustomerId ?? null,
        rebillSubscriptionId: rebillSubscriptionId ?? null,
        currentPeriodEnd: currentPeriodEnd ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to upsert subscription',
    );
  }
}

export async function getActivePartnerDiscountByCode(
  code: string,
): Promise<PartnerDiscount | null> {
  try {
    const [record] = await db
      .select()
      .from(partnerDiscount)
      .where(eq(partnerDiscount.code, code))
      .limit(1);

    if (!record) return null;
    if (!record.active) return null;

    const now = new Date();
    if (record.startsAt && record.startsAt > now) return null;
    if (record.expiresAt && record.expiresAt < now) return null;

    return record;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get partner discount by code',
    );
  }
}

export async function getDiscountRedemptionsCount(
  discountId: string,
): Promise<number> {
  try {
    const [record] = await db
      .select({ count: count() })
      .from(discountRedemption)
      .where(eq(discountRedemption.discountId, discountId));
    return record?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to count discount redemptions',
    );
  }
}

export async function getDiscountRedemptionsByUser(
  discountId: string,
  userId: string,
): Promise<number> {
  try {
    const [record] = await db
      .select({ count: count() })
      .from(discountRedemption)
      .where(
        and(
          eq(discountRedemption.discountId, discountId),
          eq(discountRedemption.userId, userId),
        ),
      );
    return record?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to count user discount redemptions',
    );
  }
}

export async function createDiscountRedemption({
  discountId,
  userId,
}: {
  discountId: string;
  userId: string;
}) {
  try {
    const [record] = await db
      .insert(discountRedemption)
      .values({
        discountId,
        userId,
        redeemedAt: new Date(),
      })
      .returning();
    return record;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create discount redemption',
    );
  }
}

export async function createUser(
  email: string,
  password: string,
  role = 'regular',
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        role,
      })
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db
      .insert(user)
      .values({
        email,
        password,
        role: 'guest',
      })
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

// New function to get users by role
export async function getUsersByRole(role: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.role, role));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get users by role',
    );
  }
}

// New function to update user role
export async function updateUserRole(userId: string, newRole: string) {
  try {
    return await db
      .update(user)
      .set({ role: newRole })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update user role',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  modelType,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  modelType?: ModelType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      modelType,
    });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    // Get all chat IDs for the user
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    const chatIds = userChats.map((chat) => chat.id);

    if (chatIds.length === 0) {
      return { deletedChats: 0 };
    }

    // Delete all votes for all user's chats
    await db.delete(vote).where(inArray(vote.chatId, chatIds));

    // Delete all messages for all user's chats
    await db.delete(message).where(inArray(message.chatId, chatIds));

    // Delete all streams for all user's chats
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    // Delete all chats for the user
    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedChats: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete all chats for user',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
