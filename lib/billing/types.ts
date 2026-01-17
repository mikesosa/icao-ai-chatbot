export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'cancelled'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'unknown';

export type SubscriptionSummary = {
  status: SubscriptionStatus;
  planId?: string | null;
  currentPeriodEnd?: string | null;
};
