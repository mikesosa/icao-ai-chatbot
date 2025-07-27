import type { UserType } from '@/app/(auth)/auth';
import { examConfigService } from '@/lib/services/exam-config-service';
import {
  getAvailableExamIds,
  getAvailableExamIdsFromConfigs,
} from '@/lib/types';

import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  canSkipExamSections?: boolean;
}

// Get all available exam model IDs dynamically (sync from fallback data for SSR)
const getAllExamModelIds = (): string[] => {
  const modelIds = getAvailableExamIds();
  return modelIds.length > 0
    ? modelIds
    : examConfigService.getFallbackModelIds();
};

// Get all available exam model IDs from provided configurations (for client-side SWR)
export const getAllExamModelIdsFromConfigs = (
  configs: Record<string, any>,
): string[] => {
  const modelIds = getAvailableExamIdsFromConfigs(configs);
  return modelIds.length > 0
    ? modelIds
    : examConfigService.getFallbackModelIds();
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: getAllExamModelIds(),
    canSkipExamSections: false,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: getAllExamModelIds(),
    canSkipExamSections: false,
  },

  /*
   * For admin users with special privileges
   */
  admin: {
    maxMessagesPerDay: -1, // unlimited
    availableChatModelIds: getAllExamModelIds(),
    canSkipExamSections: true,
  },
};

// Function to get updated entitlements with latest model IDs (for client-side SWR data)
export const getUpdatedEntitlements = (
  configs: Record<string, any>,
): Record<UserType, Entitlements> => {
  const latestModelIds = getAllExamModelIdsFromConfigs(configs);

  return {
    guest: {
      ...entitlementsByUserType.guest,
      availableChatModelIds: latestModelIds,
    },
    regular: {
      ...entitlementsByUserType.regular,
      availableChatModelIds: latestModelIds,
    },
    admin: {
      ...entitlementsByUserType.admin,
      availableChatModelIds: latestModelIds,
    },
  };
};
