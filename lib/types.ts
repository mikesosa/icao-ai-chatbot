import { examConfigService } from '@/lib/services/exam-config-service';

export type DataPart = { type: 'append-message'; message: string };

// Generate dynamic model IDs from configurations
export function generateModelIds(
  configs: Record<string, any>,
): Record<string, string> {
  return examConfigService.generateModelIds(configs);
}

// Dynamic Model ID constants generated from fallback exam configs (for SSR)
export const MODEL_IDS = examConfigService.generateModelIds(
  examConfigService.getConfigurationsSync(),
);

// Get all available exam IDs from fallback configurations (sync for SSR)
export const getAvailableExamIds = (): string[] => {
  return examConfigService.getAvailableExamIdsSync();
};

// Check if a model ID exists in the fallback configurations (sync for SSR)
export const isValidExamModel = (modelId: string): boolean => {
  return examConfigService.isValidExamIdSync(modelId);
};

// Generate model IDs from provided configurations (for client-side use with SWR)
export function getAvailableExamIdsFromConfigs(
  configs: Record<string, any>,
): string[] {
  return Object.keys(configs);
}

// Check if a model ID exists in provided configurations (for client-side use with SWR)
export function isValidExamModelInConfigs(
  modelId: string,
  configs: Record<string, any>,
): boolean {
  return Object.keys(configs).includes(modelId);
}

// Model types - now dynamically determined
export const MODEL_TYPES = {
  GENERAL: 'general',
  EXAM_EVALUATOR: 'exam-evaluator',
} as const;

export type ModelType = (typeof MODEL_TYPES)[keyof typeof MODEL_TYPES];

export const MODEL_TYPE_VALUES = Object.values(MODEL_TYPES) as [
  ModelType,
  ...ModelType[],
];

// Dynamic Model ID to Type mapping (sync for SSR)
export const getModelType = (modelId: string): ModelType => {
  if (isValidExamModel(modelId)) {
    return MODEL_TYPES.EXAM_EVALUATOR;
  }
  return MODEL_TYPES.GENERAL;
};

// Dynamic Model ID to Type mapping (for client-side use with SWR data)
export function getModelTypeFromConfigs(
  modelId: string,
  configs: Record<string, any>,
): ModelType {
  if (isValidExamModelInConfigs(modelId, configs)) {
    return MODEL_TYPES.EXAM_EVALUATOR;
  }
  return MODEL_TYPES.GENERAL;
}
