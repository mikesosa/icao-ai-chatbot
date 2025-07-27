import useSWR from 'swr';

import type { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';
import { fetcher } from '@/lib/utils';

interface ExamConfigsResponse {
  available: string[];
  configs: Record<string, SerializedCompleteExamConfig>;
  lastUpdated: string;
  totalConfigs: number;
}

/**
 * Hook to fetch all exam configurations using SWR
 */
export function useExamConfigs() {
  const { data, error, isLoading, mutate } = useSWR<ExamConfigsResponse>(
    '/api/exam-configs',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    },
  );

  return {
    configs: data?.configs || {},
    availableIds: data?.available || [],
    totalConfigs: data?.totalConfigs || 0,
    lastUpdated: data?.lastUpdated,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook to fetch a specific exam configuration using SWR
 */
export function useExamConfig(examId: string | null) {
  const { data, error, isLoading, mutate } =
    useSWR<SerializedCompleteExamConfig>(
      examId ? `/api/exam-configs?id=${examId}` : null,
      fetcher,
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      },
    );

  return {
    config: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook to get available exam IDs (lightweight version)
 */
export function useAvailableExamIds() {
  const { availableIds, isLoading, error } = useExamConfigs();

  return {
    examIds: availableIds,
    isLoading,
    error,
  };
}
