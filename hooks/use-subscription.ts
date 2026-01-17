import useSWR from 'swr';

import { fetcher } from '@/lib/utils';

export type SubscriptionApiResponse = {
  status: string;
  isActive: boolean;
  planId: string | null;
  currentPeriodEnd: string | null;
};

export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionApiResponse>(
    '/api/billing/subscription',
    fetcher,
  );

  return {
    subscription: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
