# Exam Section Skipping Implementation Plan

## 📋 Overview

This document outlines the implementation plan for adding section skipping functionality to the ICAO AI Chatbot exam system. The feature will allow administrators to jump between exam sections for testing and administrative purposes while maintaining exam integrity for regular users.

## 🎯 Current State Analysis

### Exam System

- **Navigation Control**: Strict progressive locks prevent users from jumping to future sections
- **Current Restrictions**: Users can only access completed sections or current section
- **Key Components**:
  - `ExamContext` manages exam state
  - `ExamSidebar` and `ExamSectionControls` handle navigation
- **Progressive validation** in `handleSectionChange` and `handleSubsectionChange`

### User System

- **Current Types**: Only `guest` and `regular` users exist
- **No Admin System**: No role-based permissions or admin functionality
- **Entitlements**: Based on user type, controls model access and message limits

### Development Environment

- **Detection Available**: `isDevelopmentEnvironment` constant exists
- **No Special Privileges**: Development mode doesn't bypass any restrictions currently

## 🚀 Implementation Phases

### **Phase 1: Add Admin User Type**

#### 1.1 Update User Types

**File: `app/(auth)/auth.ts`**

```typescript
export type UserType = 'guest' | 'regular' | 'admin';
```

#### 1.2 Database Migration

**New Migration File: `lib/db/migrations/XXXX_add_user_roles.sql`**

```sql
-- Add migration for admin users
ALTER TABLE "User" ADD COLUMN "role" varchar(20) DEFAULT 'regular';
UPDATE "User" SET "role" = 'regular' WHERE "role" IS NULL;
```

**Update Schema: `lib/db/schema.ts`**

```typescript
export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  role: varchar('role', { length: 20 }).default('regular'), // Add this line
});
```

#### 1.3 Update Entitlements System

**File: `lib/ai/entitlements.ts`**

```typescript
interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  canSkipExamSections?: boolean; // New permission
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    /* existing */
  },
  regular: {
    /* existing */
  },
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

### **Phase 2: Modify Navigation Controls**

#### 2.1 Update ExamSidebar Component

**File: `components/exam-interface/exam-sidebar.tsx`**

```typescript
import { useSession } from 'next-auth/react';

export function ExamSidebar({ initialMessages, examConfig }: ExamSidebarProps) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  const handleSectionChange = (section: ExamSection) => {
    // Admin bypass
    if (isAdmin) {
      setCurrentSection(section.toString());
      setCurrentSubsection(null);
      toast.info(`[Admin Mode] Jumped to Section ${section}`);
      return;
    }

    // Existing progressive lock logic for regular users...
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) =>
      Number.parseInt(s),
    );

    if (
      section > currentSectionNum &&
      !completedSectionNums.includes(section)
    ) {
      toast.warning(
        'Complete current section before advancing to future sections',
      );
      return;
    }

    // Rest of existing logic...
  };

  const handleSubsectionChange = (subsectionId: string) => {
    // Admin bypass
    if (isAdmin) {
      const subsectionSection = Number.parseInt(subsectionId.charAt(0));
      if (subsectionSection !== Number.parseInt(currentSection || '1')) {
        setCurrentSection(subsectionSection.toString());
      }
      setCurrentSubsection(subsectionId);
      toast.info(`[Admin Mode] Jumped to Subsection ${subsectionId}`);
      return;
    }

    // Existing progressive lock logic for regular users...
  };
}
```

#### 2.2 Update ExamSectionControls Component

**File: `components/exam-interface/exam-section-controls.tsx`**

```typescript
import { useSession } from 'next-auth/react';
import { Settings } from 'lucide-react';

export function ExamSectionControls({...}: ExamSectionControlsProps) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Exam Controls</span>
          {isAdmin && (
            <Badge variant="destructive" className="text-xs">
              Admin Mode
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing controls */}

        {isAdmin && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Settings className="size-4" />
                <span className="text-sm font-medium">Admin Controls</span>
              </div>

              <div className="text-xs text-muted-foreground mb-2">
                Section skipping enabled for testing/administration
              </div>

              {/* Quick jump buttons for all sections */}
              <div className="space-y-2">
                <Label className="text-xs">Quick Section Jump</Label>
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({length: controlsConfig.totalSections}, (_, i) => {
                    const sectionNum = i + 1;
                    const isCurrent = currentSection === sectionNum;

                    return (
                      <Button
                        key={sectionNum}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSectionChange(sectionNum)}
                        className="text-xs"
                        disabled={isCurrent}
                      >
                        §{sectionNum}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Subsection quick jump if current section has subsections */}
              {hasSubsections && (
                <div className="space-y-2">
                  <Label className="text-xs">Quick Subsection Jump</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(currentSectionSubsections).map(
                      ([subsectionId, subsection]) => {
                        const isCurrent = currentSubsection === subsectionId;

                        return (
                          <Button
                            key={subsectionId}
                            variant={isCurrent ? "default" : "outline"}
                            size="sm"
                            onClick={() => onSubsectionChange(subsectionId)}
                            className="text-xs"
                            disabled={isCurrent}
                          >
                            {subsectionId}
                          </Button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

### **Phase 3: Admin User Management**

#### 3.1 Admin Registration/Management

**File: `app/(auth)/actions.ts`**

```typescript
export const createAdminUser = async (email: string, password: string) => {
  // Only allow admin creation in development
  if (!isDevelopmentEnvironment) {
    throw new Error('Admin creation only allowed in development');
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
    throw new Error('User promotion only allowed in development');
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
```

#### 3.2 Environment Variable Control

**File: `.env.example`**

```bash
# Comma-separated list of admin emails (auto-promote on registration)
ADMIN_EMAILS=admin@example.com,dev@example.com
```

## 🔄 Migration Steps

### Step 1: Database Migration

1. Create and run database migration to add role column
2. Update existing users to have 'regular' role
3. Manually promote initial admin users

### Step 2: Core Implementation

1. Update user types and auth system
2. Modify exam navigation components to check for admin status
3. Add admin controls to exam interface

### Step 3: Testing

1. Test section skipping for admin users
2. Verify regular users still have progressive restrictions
3. Test admin user creation in development

## 🧪 Testing Strategy

### Unit Tests

- Admin user creation and promotion
- Section validation logic for different user types

### Integration Tests

- Exam navigation with admin vs regular users
- Admin controls visibility and functionality

### E2E Tests

- Complete exam flow for regular users (unchanged)
- Section skipping for admin users

## 🚨 Security Considerations

1. **Production Safety**: Admin creation only allowed in development
2. **User Type Validation**: Always check user type before allowing section skips
3. **Environment Isolation**: Admin features clearly marked and isolated

## 📊 Success Metrics

1. **Admin Efficiency**: Ability to jump to any exam section for testing
2. **System Integrity**: No impact on regular user exam experience
3. **Security**: Proper admin user management and validation

## 🔧 Configuration

### Environment Variables

```bash
# Admin user management
ADMIN_EMAILS=admin@company.com,dev@company.com
```

## 📝 Next Steps

1. **Review and Approve Plan**: Stakeholder review of simplified approach
2. **Phase 1 Implementation**: Start with user type extension and database migration
3. **Phase 2 Implementation**: Modify exam navigation components
4. **Testing**: Test admin functionality and regular user restrictions
5. **Documentation**: Create admin user guide

---

_This simplified plan focuses on the core requirement: allowing admins to skip exam sections while maintaining security and exam integrity._
