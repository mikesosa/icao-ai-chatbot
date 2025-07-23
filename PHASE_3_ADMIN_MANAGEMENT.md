# Phase 3: Admin User Management

## 📋 Overview

This phase implements admin user creation and management functions, allowing the creation of admin accounts in development mode and providing utilities to promote existing users to admin status.

## 🎯 Goals

- Create admin user creation functions
- Implement user promotion to admin role
- Add environment-based admin email auto-promotion
- Provide admin user management utilities
- Ensure security by restricting admin creation to development mode

## 🔧 Implementation Steps

### Step 3.1: Admin User Creation Functions

**File: `app/(auth)/actions.ts`**

Add admin user creation and promotion functions:

```typescript
import { isDevelopmentEnvironment } from '@/lib/constants';
import { createUser, updateUserRole } from '@/lib/db/queries';
import { generateHashedPassword } from '@/lib/utils';

export const createAdminUser = async (email: string, password: string) => {
  // Only allow admin creation in development
  if (!isDevelopmentEnvironment) {
    throw new Error('Admin creation only allowed in development mode');
  }

  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        role: 'admin',
      })
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (error) {
    throw new Error('Failed to create admin user');
  }
};

export const promoteToAdmin = async (userId: string) => {
  if (!isDevelopmentEnvironment) {
    throw new Error('User promotion only allowed in development mode');
  }

  try {
    return await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (error) {
    throw new Error('Failed to promote user to admin');
  }
};

export const demoteFromAdmin = async (userId: string) => {
  if (!isDevelopmentEnvironment) {
    throw new Error('User demotion only allowed in development mode');
  }

  try {
    return await db
      .update(user)
      .set({ role: 'regular' })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        role: user.role,
      });
  } catch (error) {
    throw new Error('Failed to demote user from admin');
  }
};
```

### Step 3.2: Environment-Based Admin Auto-Promotion

**File: `app/(auth)/register/page.tsx`**

Add auto-promotion logic for admin emails:

```typescript
import { isDevelopmentEnvironment } from '@/lib/constants';

export default function RegisterPage() {
  const handleSubmit = async (formData: FormData) => {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Check if email is in admin list
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    const isAdminEmail = adminEmails.includes(email);

    // Only auto-promote in development or if explicitly configured
    const shouldPromoteToAdmin = isDevelopmentEnvironment && isAdminEmail;

    try {
      const result = await createUser(email, password, shouldPromoteToAdmin ? 'admin' : 'regular');

      if (result) {
        toast.success(
          shouldPromoteToAdmin
            ? 'Admin account created successfully'
            : 'Account created successfully'
        );
        router.push('/login');
      }
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  return (
    // ... existing register form
  );
}
```

### Step 3.3: Admin Management API Routes

**File: `app/(auth)/api/admin/route.ts`**

Create API routes for admin management:

```typescript
import { NextRequest, NextResponse } from 'next-server';
import { isDevelopmentEnvironment } from '@/lib/constants';
import { getUsersByRole, updateUserRole } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  if (!isDevelopmentEnvironment) {
    return NextResponse.json(
      { error: 'Admin API only available in development' },
      { status: 403 },
    );
  }

  try {
    const adminUsers = await getUsersByRole('admin');
    const regularUsers = await getUsersByRole('regular');

    return NextResponse.json({
      admins: adminUsers,
      regular: regularUsers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isDevelopmentEnvironment) {
    return NextResponse.json(
      { error: 'Admin API only available in development' },
      { status: 403 },
    );
  }

  try {
    const { userId, action } = await request.json();

    if (action === 'promote') {
      const result = await updateUserRole(userId, 'admin');
      return NextResponse.json({ success: true, user: result[0] });
    } else if (action === 'demote') {
      const result = await updateUserRole(userId, 'regular');
      return NextResponse.json({ success: true, user: result[0] });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 },
    );
  }
}
```

### Step 3.4: Admin Management UI (Optional)

**File: `components/admin/admin-panel.tsx`**

Create a simple admin management interface:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Shield, Users, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  role: string;
}

export function AdminPanel() {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  const [users, setUsers] = useState<{ admins: User[]; regular: User[] }>({
    admins: [],
    regular: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (
    userId: string,
    action: 'promote' | 'demote',
  ) => {
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });

      if (response.ok) {
        toast.success(
          `User ${action === 'promote' ? 'promoted' : 'demoted'} successfully`,
        );
        fetchUsers();
      } else {
        toast.error('Failed to update user role');
      }
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="border-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Admin Panel
          <Badge variant="destructive" className="text-xs">
            Dev Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center">Loading users...</div>
        ) : (
          <>
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4" />
                Admin Users ({users.admins.length})
              </h3>
              <div className="space-y-1">
                {users.admins.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="text-sm">{user.email}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateUserRole(user.id, 'demote')}
                    >
                      <UserMinus className="size-3 mr-1" />
                      Demote
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Users className="size-4" />
                Regular Users ({users.regular.length})
              </h3>
              <div className="space-y-1">
                {users.regular.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="text-sm">{user.email}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateUserRole(user.id, 'promote')}
                    >
                      <UserPlus className="size-3 mr-1" />
                      Promote
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 3.5: Environment Variable Configuration

**File: `.env.example`**

Add admin configuration variables:

```bash
# Admin user management
ADMIN_EMAILS=admin@example.com,dev@example.com,test@example.com

# Development settings
NODE_ENV=development
```

**File: `lib/constants.ts`**

Add admin-related constants:

```typescript
export const ADMIN_CONFIG = {
  EMAILS: process.env.ADMIN_EMAILS?.split(',') || [],
  AUTO_PROMOTE: process.env.NODE_ENV === 'development',
} as const;
```

## 🧪 Testing

### Unit Tests

**File: `tests/unit/admin-management.test.ts`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createAdminUser, promoteToAdmin } from '@/app/(auth)/actions';

// Mock environment
vi.mock('@/lib/constants', () => ({
  isDevelopmentEnvironment: true,
}));

describe('Admin Management', () => {
  it('should create admin user in development mode', async () => {
    const email = 'admin@test.com';
    const password = 'password123';

    const result = await createAdminUser(email, password);

    expect(result[0].role).toBe('admin');
    expect(result[0].email).toBe(email);
  });

  it('should promote user to admin', async () => {
    const userId = 'test-user-id';

    const result = await promoteToAdmin(userId);

    expect(result[0].role).toBe('admin');
  });

  it('should reject admin creation in production', async () => {
    // Mock production environment
    vi.mocked(isDevelopmentEnvironment).mockReturnValue(false);

    await expect(createAdminUser('admin@test.com', 'password')).rejects.toThrow(
      'Admin creation only allowed in development mode',
    );
  });
});
```

### Integration Tests

**File: `tests/integration/admin-api.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';

describe('Admin API', () => {
  it('should list users by role', async () => {
    const response = await fetch('/api/admin');
    const data = await response.json();

    expect(data).toHaveProperty('admins');
    expect(data).toHaveProperty('regular');
  });

  it('should promote user to admin', async () => {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-id', action: 'promote' }),
    });

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## 📋 Checklist

- [ ] Create admin user creation function
- [ ] Create user promotion/demotion functions
- [ ] Add environment-based admin auto-promotion
- [ ] Create admin management API routes
- [ ] Add admin panel UI component (optional)
- [ ] Configure environment variables
- [ ] Add admin-related constants
- [ ] Test admin user creation
- [ ] Test user promotion/demotion
- [ ] Test environment restrictions
- [ ] Test admin API endpoints
- [ ] Test admin panel functionality
- [ ] Update documentation

## 🚨 Important Notes

1. **Development Only**: Admin creation is restricted to development mode
2. **Environment Variables**: Configure `ADMIN_EMAILS` for auto-promotion
3. **Security**: Admin functions are protected by environment checks
4. **API Protection**: Admin API routes check for development mode
5. **Auto-Promotion**: Emails in `ADMIN_EMAILS` are auto-promoted on registration

## 🔧 Configuration

### Environment Variables

```bash
# Comma-separated list of admin emails
ADMIN_EMAILS=admin@company.com,dev@company.com

# Development mode (auto-set by NODE_ENV)
NODE_ENV=development
```

## ➡️ Next Phase

After completing Phase 3, the admin section skipping functionality will be fully implemented. The system will have:

- ✅ Admin user type and database support
- ✅ Navigation controls that bypass progressive locks for admins
- ✅ Admin user management and creation functions

## 🎯 Success Criteria

- ✅ Admin users can be created in development mode
- ✅ Users can be promoted/demoted to/from admin role
- ✅ Admin emails are auto-promoted on registration
- ✅ Admin management API is functional
- ✅ Admin panel UI works correctly (optional)
- ✅ All functions are properly restricted to development mode
- ✅ Environment variables are properly configured
