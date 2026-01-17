import { NextResponse } from 'next/server';

import { auth } from '@/app/(auth)/auth';
import {
  isActiveSubscriptionStatus,
  normalizeSubscriptionStatus,
} from '@/lib/billing/subscription';
import { getSubscriptionByUserId } from '@/lib/db/queries';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { status: 'unauthorized', isActive: false },
      { status: 401 },
    );
  }

  const subscription = await getSubscriptionByUserId(session.user.id);
  const status = normalizeSubscriptionStatus(subscription?.status);

  return NextResponse.json({
    status,
    isActive: isActiveSubscriptionStatus(status),
    planId: subscription?.planId ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd
      ? subscription.currentPeriodEnd.toISOString()
      : null,
  });
}
