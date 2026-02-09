import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

import { MODEL_IDS, getAvailableExamIds } from '@/lib/types';

import { isTestEnvironment } from '../constants';

import {
  artifactModel,
  chatModel,
  elpacEvaluatorModel,
  reasoningModel,
  teaEvaluatorModel,
  titleModel,
} from './models.test';

// Build language model map with all exam evaluators
function buildLanguageModels() {
  const baseModels = {
    [MODEL_IDS.CHAT_MODEL]: isTestEnvironment ? chatModel : openai('gpt-4o'),
    [MODEL_IDS.CHAT_MODEL_REASONING]: isTestEnvironment
      ? reasoningModel
      : wrapLanguageModel({
          model: openai('o1-mini'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
    [MODEL_IDS.TITLE_MODEL]: isTestEnvironment
      ? titleModel
      : openai('gpt-4o-mini'),
    [MODEL_IDS.ARTIFACT_MODEL]: isTestEnvironment
      ? artifactModel
      : openai('gpt-4o'),
  };

  // Add all exam evaluators dynamically
  const examIds = getAvailableExamIds();
  for (const examId of examIds) {
    baseModels[examId] = isTestEnvironment
      ? examId === MODEL_IDS.TEA_EVALUATOR
        ? teaEvaluatorModel
        : elpacEvaluatorModel
      : openai('gpt-4o');
  }

  return baseModels;
}

export const myProvider = customProvider({
  languageModels: buildLanguageModels(),
  imageModels: {
    'small-model': xai.image('grok-2-image'),
  },
});
