import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';
import { MODEL_IDS } from '@/lib/types';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: [MODEL_IDS.CHAT_MODEL, MODEL_IDS.CHAT_MODEL_REASONING],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [MODEL_IDS.CHAT_MODEL, MODEL_IDS.CHAT_MODEL_REASONING, MODEL_IDS.TEA_EVALUATOR, MODEL_IDS.ELPAC_EVALUATOR],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
