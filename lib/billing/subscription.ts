import type { SubscriptionStatus } from './types';

export const isActiveSubscriptionStatus = (status: string | null | undefined) =>
  status === 'active' || status === 'trialing';

export const normalizeSubscriptionStatus = (
  status: string | null | undefined,
): SubscriptionStatus => {
  if (!status) return 'unknown';
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'active':
    case 'trialing':
    case 'canceled':
    case 'cancelled':
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return normalized;
    default:
      return 'unknown';
  }
};
