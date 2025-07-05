export type DataPart = { type: 'append-message'; message: string };

// Centralized Model ID constants
export const MODEL_IDS = {
  CHAT_MODEL: 'chat-model',
  CHAT_MODEL_REASONING: 'chat-model-reasoning',
  TITLE_MODEL: 'title-model',
  ARTIFACT_MODEL: 'artifact-model',
  TEA_EVALUATOR: 'tea-evaluator',
  ELPAC_EVALUATOR: 'elpac-evaluator',
} as const;

// Centralized Model Type definitions
export const MODEL_TYPES = {
  GENERAL: 'general',
  TEA_EVALUATOR: 'tea-evaluator',
  ELPAC_EVALUATOR: 'elpac-evaluator',
} as const;

export type ModelType = typeof MODEL_TYPES[keyof typeof MODEL_TYPES];

export const MODEL_TYPE_VALUES = Object.values(MODEL_TYPES) as [ModelType, ...ModelType[]];

// Model ID to Type mapping
export const MODEL_ID_TO_TYPE_MAP = {
  [MODEL_IDS.CHAT_MODEL]: MODEL_TYPES.GENERAL,
  [MODEL_IDS.CHAT_MODEL_REASONING]: MODEL_TYPES.GENERAL,
  [MODEL_IDS.TITLE_MODEL]: MODEL_TYPES.GENERAL,
  [MODEL_IDS.ARTIFACT_MODEL]: MODEL_TYPES.GENERAL,
  [MODEL_IDS.TEA_EVALUATOR]: MODEL_TYPES.TEA_EVALUATOR,
  [MODEL_IDS.ELPAC_EVALUATOR]: MODEL_TYPES.ELPAC_EVALUATOR,
} as const;