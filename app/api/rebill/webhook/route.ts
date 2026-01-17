import { NextResponse } from 'next/server';

import { normalizeSubscriptionStatus } from '@/lib/billing/subscription';
import { getUser, upsertSubscriptionForUser } from '@/lib/db/queries';

const getAuthCredentials = () => {
  const username = process.env.REBILL_WEBHOOK_USERNAME;
  const password = process.env.REBILL_WEBHOOK_PASSWORD;
  const bearer = process.env.REBILL_WEBHOOK_SECRET;
  return { username, password, bearer };
};

const isAuthorized = (authHeader: string | null) => {
  const { username, password, bearer } = getAuthCredentials();

  if (bearer && authHeader?.startsWith('Bearer ')) {
    return authHeader === `Bearer ${bearer}`;
  }

  if (username && password && authHeader?.startsWith('Basic ')) {
    const encoded = authHeader.replace('Basic ', '');
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return decoded === `${username}:${password}`;
  }

  return false;
};

const parseDate = (value: unknown) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractSubscriptionPayload = (payload: any) => {
  const eventType =
    payload?.eventType ?? payload?.type ?? payload?.event?.type ?? 'unknown';

  const subscription =
    payload?._embedded?.subscription ??
    payload?.subscription ??
    payload?.data?.subscription ??
    payload?.subscription?.data ??
    null;

  const customer =
    payload?._embedded?.customer ??
    payload?.customer ??
    payload?.data?.customer ??
    subscription?.customer ??
    null;

  return {
    eventType,
    subscriptionId:
      subscription?.id ??
      payload?.subscriptionId ??
      payload?.subscription_id ??
      null,
    customerId:
      customer?.id ?? payload?.customerId ?? payload?.customer_id ?? null,
    email:
      customer?.email ??
      payload?.customerEmail ??
      payload?.customer?.email ??
      null,
    status:
      subscription?.status ??
      payload?.subscriptionStatus ??
      payload?.status ??
      'unknown',
    planId:
      subscription?.planId ?? subscription?.plan?.id ?? payload?.planId ?? null,
    currentPeriodEnd:
      subscription?.currentPeriodEndTime ??
      subscription?.currentPeriodEnd ??
      subscription?.renewalTime ??
      payload?.currentPeriodEnd ??
      null,
  };
};

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!isAuthorized(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();
  const extracted = extractSubscriptionPayload(payload);

  if (!extracted.email) {
    return NextResponse.json(
      { received: true, reason: 'Missing customer email' },
      { status: 200 },
    );
  }

  const users = await getUser(extracted.email);
  const user = users[0];

  if (!user) {
    return NextResponse.json(
      { received: true, reason: 'User not found' },
      { status: 200 },
    );
  }

  const status = normalizeSubscriptionStatus(extracted.status);

  await upsertSubscriptionForUser({
    userId: user.id,
    status,
    planId: extracted.planId,
    rebillCustomerId: extracted.customerId,
    rebillSubscriptionId: extracted.subscriptionId,
    currentPeriodEnd: parseDate(extracted.currentPeriodEnd),
  });

  return NextResponse.json({ received: true, eventType: extracted.eventType });
}
