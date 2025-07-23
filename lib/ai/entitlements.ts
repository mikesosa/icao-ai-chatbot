import type { UserType } from '@/app/(auth)/auth';
import { MODEL_IDS } from '@/lib/types';

import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
  canSkipExamSections?: boolean;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
    ],
    canSkipExamSections: false,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
      MODEL_IDS.TEA_EVALUATOR,
      MODEL_IDS.ELPAC_EVALUATOR,
    ],
    canSkipExamSections: false,
  },

  /*
   * For admin users with special privileges
   */
  admin: {
    maxMessagesPerDay: -1, // unlimited
    availableChatModelIds: [
      MODEL_IDS.CHAT_MODEL,
      MODEL_IDS.CHAT_MODEL_REASONING,
      MODEL_IDS.TEA_EVALUATOR,
      MODEL_IDS.ELPAC_EVALUATOR,
    ],
    canSkipExamSections: true,
  },
};
