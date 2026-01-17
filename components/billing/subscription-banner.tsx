'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/use-subscription';

export function SubscriptionBanner() {
  const { subscription, isLoading } = useSubscription();

  if (isLoading) return null;
  if (!subscription || subscription.isActive) return null;

  return (
    <div className="w-full border-b border-border bg-muted/30 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Subscription required</div>
          <div className="text-xs text-muted-foreground">
            Activate a plan to access all exams.
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/billing">View plans</Link>
        </Button>
      </div>
    </div>
  );
}
