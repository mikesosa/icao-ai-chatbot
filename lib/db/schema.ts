import type { InferSelectModel } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { MODEL_TYPE_VALUES } from '@/lib/types';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  role: varchar('role', { length: 20 }).default('regular'),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
  modelType: varchar('modelType', { enum: MODEL_TYPE_VALUES }).default(
    'general',
  ),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

export const subscription = pgTable('Subscription', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  status: varchar('status', { length: 32 }).notNull(),
  planId: varchar('planId', { length: 64 }),
  rebillCustomerId: varchar('rebillCustomerId', { length: 64 }),
  rebillSubscriptionId: varchar('rebillSubscriptionId', { length: 64 }),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type Subscription = InferSelectModel<typeof subscription>;

export const partnerDiscount = pgTable('PartnerDiscount', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  partnerSlug: varchar('partnerSlug', { length: 64 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  discountType: varchar('discountType', { length: 16 }).notNull(),
  discountValue: varchar('discountValue', { length: 32 }).notNull(),
  active: boolean('active').notNull().default(true),
  startsAt: timestamp('startsAt'),
  expiresAt: timestamp('expiresAt'),
  maxRedemptions: varchar('maxRedemptions', { length: 16 }),
  maxRedemptionsPerUser: varchar('maxRedemptionsPerUser', { length: 16 }),
  eligiblePlans: json('eligiblePlans'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type PartnerDiscount = InferSelectModel<typeof partnerDiscount>;

export const discountRedemption = pgTable('DiscountRedemption', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  discountId: uuid('discountId')
    .notNull()
    .references(() => partnerDiscount.id),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id),
  redeemedAt: timestamp('redeemedAt').notNull(),
});

export type DiscountRedemption = InferSelectModel<typeof discountRedemption>;
