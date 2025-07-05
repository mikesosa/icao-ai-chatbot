import { MODEL_IDS } from '@/lib/types';

export const DEFAULT_CHAT_MODEL: string = MODEL_IDS.CHAT_MODEL;

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  // {
  //   id: MODEL_IDS.CHAT_MODEL,
  //   name: 'Chat model',
  //   description: 'Primary model for all-purpose chat',
  // },
  // {
  //   id: MODEL_IDS.CHAT_MODEL_REASONING,
  //   name: 'Reasoning model',
  //   description: 'Uses advanced reasoning',
  // },
  {
    id: MODEL_IDS.TEA_EVALUATOR,
    name: 'TEA Evaluator',
    description: 'Test of English for Aviation (TEA) exams',
  },
  {
    id: MODEL_IDS.ELPAC_EVALUATOR,
    name: 'ELPAC Evaluator',
    description: 'English Language Proficiency Assessment for Aviation (ELPAC)',
  },
];
