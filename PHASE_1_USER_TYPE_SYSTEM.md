# Phase 1: Extend User Type System

## 📋 Overview

This phase extends the existing user type system to include admin users, updates the database schema, and modifies the entitlements system to support the new admin role.

## 🎯 Goals

- Add `admin` user type to the existing `guest` and `regular` types
- Update database schema to store user roles
- Modify entitlements system to include admin permissions
- Prepare foundation for permission-based section skipping

## 🔧 Implementation Steps

### Step 1.1: Update User Types and Database Schema

**File: `app/(auth)/auth.ts`**

Update the UserType definition:

```typescript
export type UserType = 'guest' | 'regular' | 'admin';
```

### Step 1.2: Database Migration

**New Migration File: `lib/db/migrations/XXXX_add_user_roles.sql`**

```sql
-- Add migration for admin users
ALTER TABLE "User" ADD COLUMN "role" varchar(20) DEFAULT 'regular';
UPDATE "User" SET "role" = 'regular' WHERE "role" IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_role ON "User"("role");
```

**Update Schema: `lib/db/schema.ts`**

Add the role column to the user table:

```typescript
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
  role: varchar('role', { length: 20 }).default('regular'), // Add this line
});

export type User = InferSelectModel<typeof user>;
```

### Step 1.3: Update Entitlements System

**File: `lib/ai/entitlements.ts`**

Extend the entitlements interface and add admin permissions:

```typescript
import type { UserType } from '@/app/(auth)/auth';
import { MODEL_IDS } from '@/lib/types';

import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  canSkipExamSections?: boolean; // New permission for section skipping
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
    ],
    canSkipExamSections: false,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
      MODEL_IDS.TEA_EVALUATOR,
      MODEL_IDS.ELPAC_EVALUATOR,
    ],
    canSkipExamSections: false,
  },

  /*
   * For admin users with special privileges
   */
  admin: {
    maxMessagesPerDay: -1, // unlimited
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
      MODEL_IDS.TEA_EVALUATOR,
      MODEL_IDS.ELPAC_EVALUATOR,
    ],
    canSkipExamSections: true, // new permission
  },
};
```

### Step 1.4: Update Auth System

**File: `app/(auth)/auth.ts`**

Update the auth system to handle the new user type:

```typescript
import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

import { DUMMY_PASSWORD } from '@/lib/constants';
import { createGuestUser, getUser } from '@/lib/db/queries';

import { authConfig } from './auth.config';

export type UserType = 'guest' | 'regular' | 'admin';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      role?: string; // Add role to session
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    role?: string; // Add role to user
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    role?: string; // Add role to JWT
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) return null;

        // Determine user type based on role
        const userType: UserType = user.role === 'admin' ? 'admin' : 'regular';

        return {
          ...user,
          type: userType,
          role: user.role,
        };
      },
    }),
    Credentials({
      id: 'guest',
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return {
          ...guestUser,
          type: 'guest' as UserType,
          role: 'guest',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.role = token.role;
      }

      return session;
    },
  },
});
```

### Step 1.5: Update Database Queries

**File: `lib/db/queries.ts`**

Update queries to handle the new role column:

```typescript
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

export async function createUser(
  email: string,
  password: string,
  role: string = 'regular',
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
```

## 🧪 Testing

### Unit Tests

Create tests for the new user types and database operations:

**File: `tests/unit/user-types.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import type { UserType } from '@/app/(auth)/auth';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

describe('User Types', () => {
  it('should have correct entitlements for admin users', () => {
    const adminEntitlements = entitlementsByUserType.admin;

    expect(adminEntitlements.maxMessagesPerDay).toBe(-1);
    expect(adminEntitlements.canSkipExamSections).toBe(true);
    expect(adminEntitlements.availableChatModelIds).toContain('tea-evaluator');
  });

  it('should have section skipping disabled for regular users', () => {
    const regularEntitlements = entitlementsByUserType.regular;

    expect(regularEntitlements.canSkipExamSections).toBe(false);
  });

  it('should have section skipping disabled for guest users', () => {
    const guestEntitlements = entitlementsByUserType.guest;

    expect(guestEntitlements.canSkipExamSections).toBe(false);
  });
});
```

### Integration Tests

**File: `tests/integration/user-role-migration.test.ts`**

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { createUser, getUsersByRole, updateUserRole } from '@/lib/db/queries';

describe('User Role Migration', () => {
  beforeEach(async () => {
    // Setup test database
  });

  it('should create users with default regular role', async () => {
    const email = 'test@example.com';
    const password = 'password123';

    const [user] = await createUser(email, password);

    expect(user.role).toBe('regular');
  });

  it('should allow creating admin users', async () => {
    const email = 'admin@example.com';
    const password = 'password123';

    const [user] = await createUser(email, password, 'admin');

    expect(user.role).toBe('admin');
  });

  it('should update user role successfully', async () => {
    const email = 'user@example.com';
    const password = 'password123';

    const [user] = await createUser(email, password);
    const [updatedUser] = await updateUserRole(user.id, 'admin');

    expect(updatedUser.role).toBe('admin');
  });
});
```

## 🔄 Migration Script

**File: `scripts/migrate-user-roles.ts`**

```typescript
#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { user } from '@/lib/db/schema';

async function migrateUserRoles() {
  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  console.log('Starting user role migration...');

  try {
    // Add the role column if it doesn't exist
    await client`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'regular'
    `;

    // Update existing users to have 'regular' role
    await client`
      UPDATE "User" 
      SET "role" = 'regular' 
      WHERE "role" IS NULL
    `;

    // Add index for performance
    await client`
      CREATE INDEX IF NOT EXISTS idx_user_role ON "User"("role")
    `;

    console.log('✅ User role migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateUserRoles()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migrateUserRoles };
```

## 📋 Checklist

- [ ] Update `UserType` definition in `app/(auth)/auth.ts`
- [ ] Create database migration file
- [ ] Update database schema in `lib/db/schema.ts`
- [ ] Modify entitlements system in `lib/ai/entitlements.ts`
- [ ] Update auth system to handle new user types
- [ ] Update database queries to support role column
- [ ] Create migration script
- [ ] Write unit tests for new user types
- [ ] Write integration tests for role migration
- [ ] Run migration on development database
- [ ] Verify existing users have 'regular' role
- [ ] Test admin user creation
- [ ] Update TypeScript types throughout the codebase

## 🚨 Important Notes

1. **Backward Compatibility**: Existing users will automatically get the 'regular' role
2. **Database Backup**: Always backup the database before running migrations
3. **Environment Variables**: No new environment variables required for this phase
4. **Session Updates**: Users may need to re-login to get updated session data with roles

## ➡️ Next Phase

After completing Phase 1, proceed to [Phase 2: Create Permission System](./PHASE_2_PERMISSION_SYSTEM.md) to implement the permission utilities and context.
