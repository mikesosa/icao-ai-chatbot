# Phase 2: Modify Navigation Controls

## 📋 Overview

This phase modifies the exam navigation components to allow admin users to skip exam sections while maintaining progressive restrictions for regular users. The changes focus on updating the `ExamSidebar` and `ExamSectionControls` components to check for admin status and bypass the normal progressive locks.

## 🎯 Goals

- Allow admin users to jump to any exam section
- Maintain progressive restrictions for regular users
- Add visual indicators for admin mode
- Provide quick jump controls for admins

## 🔧 Implementation Steps

### Step 2.1: Update ExamSidebar Component

**File: `components/exam-interface/exam-sidebar.tsx`**

Add admin bypass logic to the section and subsection change handlers:

```typescript
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

export function ExamSidebar({ initialMessages, examConfig }: ExamSidebarProps) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  const handleSectionChange = (section: ExamSection) => {
    // Admin bypass - allow jumping to any section
    if (isAdmin) {
      setCurrentSection(section.toString());
      setCurrentSubsection(null);
      toast.info(`[Admin Mode] Jumped to Section ${section}`);
      return;
    }

    // Existing progressive lock logic for regular users
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

    // Rest of existing logic for regular users
    setCurrentSection(section.toString());
    setCurrentSubsection(null);
  };

  const handleSubsectionChange = (subsectionId: string) => {
    // Admin bypass - allow jumping to any subsection
    if (isAdmin) {
      const subsectionSection = Number.parseInt(subsectionId.charAt(0));
      if (subsectionSection !== Number.parseInt(currentSection || '1')) {
        setCurrentSection(subsectionSection.toString());
      }
      setCurrentSubsection(subsectionId);
      toast.info(`[Admin Mode] Jumped to Subsection ${subsectionId}`);
      return;
    }

    // Existing progressive lock logic for regular users
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const subsectionSection = Number.parseInt(subsectionId.charAt(0));

    if (subsectionSection > currentSectionNum) {
      toast.warning(
        'Complete current section before advancing to future subsections',
      );
      return;
    }

    // Rest of existing logic for regular users
    setCurrentSubsection(subsectionId);
  };

  // Rest of component remains the same
}
```

### Step 2.2: Update ExamSectionControls Component

**File: `components/exam-interface/exam-section-controls.tsx`**

Add admin controls and visual indicators:

```typescript
import { useSession } from 'next-auth/react';
import { Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

export function ExamSectionControls({
  currentSection,
  currentSubsection,
  completedSections,
  onSectionChange,
  onSubsectionChange,
  controlsConfig,
  currentSectionSubsections,
  hasSubsections,
}: ExamSectionControlsProps) {
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
        {/* Existing controls for all users */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Current Section</Label>
          <div className="text-sm text-muted-foreground">
            Section {currentSection || 'None'}
            {currentSubsection && ` - Subsection ${currentSubsection}`}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Progress</Label>
          <div className="text-sm text-muted-foreground">
            {completedSections.length} of {controlsConfig.totalSections}{' '}
            sections completed
          </div>
        </div>

        {/* Admin-only controls */}
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
                  {Array.from(
                    { length: controlsConfig.totalSections },
                    (_, i) => {
                      const sectionNum = i + 1;
                      const isCurrent =
                        currentSection === sectionNum.toString();
                      const isCompleted = completedSections.includes(
                        sectionNum.toString(),
                      );

                      return (
                        <Button
                          key={sectionNum}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSectionChange(sectionNum)}
                          className="text-xs"
                          disabled={isCurrent}
                        >
                          {isCompleted && '✓'} §{sectionNum}
                        </Button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Subsection quick jump if current section has subsections */}
              {hasSubsections && currentSectionSubsections && (
                <div className="space-y-2">
                  <Label className="text-xs">Quick Subsection Jump</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(currentSectionSubsections).map(
                      ([subsectionId, subsection]) => {
                        const isCurrent = currentSubsection === subsectionId;

                        return (
                          <Button
                            key={subsectionId}
                            variant={isCurrent ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onSubsectionChange(subsectionId)}
                            className="text-xs"
                            disabled={isCurrent}
                          >
                            {subsectionId}
                          </Button>
                        );
                      },
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

### Step 2.3: Update Exam Context (Optional Enhancement)

**File: `contexts/exam-context.tsx`**

Add admin-specific actions to the exam context:

```typescript
import { useSession } from 'next-auth/react';

export function ExamProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  // ... existing state and logic

  const jumpToSection = (section: string) => {
    if (!isAdmin) {
      console.warn('Only admins can jump to sections');
      return;
    }

    console.log(`[ADMIN] Jumping to section ${section}`);
    setCurrentSection(section);
    setCurrentSubsection(null);
  };

  const jumpToSubsection = (subsection: string) => {
    if (!isAdmin) {
      console.warn('Only admins can jump to subsections');
      return;
    }

    console.log(`[ADMIN] Jumping to subsection ${subsection}`);
    setCurrentSubsection(subsection);

    // Auto-switch section if needed
    const subsectionSection = subsection.charAt(0);
    if (currentSection !== subsectionSection) {
      setCurrentSection(subsectionSection);
    }
  };

  const completeAllSections = () => {
    if (!isAdmin) {
      console.warn('Only admins can complete all sections');
      return;
    }

    console.log('[ADMIN] Completing all sections');
    const allSections = Array.from({ length: totalSections }, (_, i) =>
      (i + 1).toString(),
    );
    setCompletedSections(allSections);
    setExamProgress(100);
  };

  const resetProgress = () => {
    if (!isAdmin) {
      console.warn('Only admins can reset progress');
      return;
    }

    console.log('[ADMIN] Resetting exam progress');
    setCompletedSections([]);
    setCompletedSubsections([]);
    setExamProgress(0);
    setCurrentSection('1');
    setCurrentSubsection(null);
  };

  return (
    <ExamContext.Provider
      value={{
        // ... existing values
        isAdmin,
        jumpToSection,
        jumpToSubsection,
        completeAllSections,
        resetProgress,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}
```

### Step 2.4: Add Admin Status Indicator

**File: `components/exam-interface/exam-timer.tsx`**

Add admin indicator to the exam timer component:

```typescript
import { useSession } from 'next-auth/react';
import { Shield } from 'lucide-react';

export function ExamTimer({ timeLeft, isPaused }: ExamTimerProps) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-mono">{formatTime(timeLeft)}</div>
      {isPaused && (
        <Badge variant="secondary" className="text-xs">
          PAUSED
        </Badge>
      )}
      {isAdmin && (
        <Badge
          variant="destructive"
          className="text-xs flex items-center gap-1"
        >
          <Shield className="size-3" />
          ADMIN
        </Badge>
      )}
    </div>
  );
}
```

## 🧪 Testing

### Unit Tests

**File: `tests/unit/navigation-controls.test.tsx`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExamSidebar } from '@/components/exam-interface/exam-sidebar';

// Mock session
const mockAdminSession = {
  user: { type: 'admin' as const },
};

const mockRegularSession = {
  user: { type: 'regular' as const },
};

describe('ExamSidebar Navigation', () => {
  it('should allow admin to jump to any section', () => {
    // Test admin section jumping
  });

  it('should prevent regular user from jumping to future sections', () => {
    // Test regular user restrictions
  });

  it('should show admin controls for admin users', () => {
    // Test admin UI elements
  });
});
```

### Integration Tests

**File: `tests/integration/admin-navigation.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';

describe('Admin Navigation Integration', () => {
  it('should bypass progressive locks for admin users', async () => {
    // Test complete admin navigation flow
  });

  it('should maintain restrictions for regular users', async () => {
    // Test regular user restrictions remain intact
  });

  it('should show appropriate UI indicators', async () => {
    // Test admin badges and controls visibility
  });
});
```

## 📋 Checklist

- [ ] Update `ExamSidebar` component with admin bypass logic
- [ ] Update `ExamSectionControls` component with admin controls
- [ ] Add admin status indicators to exam interface
- [ ] Update exam context with admin-specific actions (optional)
- [ ] Add admin badge to exam timer component
- [ ] Test admin section jumping functionality
- [ ] Test regular user restrictions remain intact
- [ ] Test admin controls visibility
- [ ] Test admin status indicators
- [ ] Update TypeScript types for admin actions
- [ ] Add console logging for admin actions
- [ ] Test toast notifications for admin actions

## 🚨 Important Notes

1. **Security**: Admin checks are performed on both client and server side
2. **User Experience**: Regular users should not see any difference in behavior
3. **Visual Indicators**: Admin mode is clearly marked with badges and controls
4. **Logging**: Admin actions are logged for audit purposes
5. **Progressive Locks**: Only admins can bypass, regular users still follow normal flow

## 🔧 Configuration

No additional configuration required for this phase. The admin functionality is controlled by the user type from the session.

## ➡️ Next Phase

After completing Phase 2, proceed to [Phase 3: Admin User Management](./PHASE_3_ADMIN_MANAGEMENT.md) to implement admin user creation and management functions.

## 🎯 Success Criteria

- ✅ Admin users can jump to any exam section
- ✅ Regular users still have progressive restrictions
- ✅ Admin mode is clearly indicated in the UI
- ✅ Quick jump controls are available for admins
- ✅ No impact on regular user experience
- ✅ Proper error handling and validation
