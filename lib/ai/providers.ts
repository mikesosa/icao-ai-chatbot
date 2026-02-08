import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';

import { MODEL_IDS } from '@/lib/types';

import { isTestEnvironment } from '../constants';

import {
  artifactModel,
  chatModel,
  elpacEvaluatorModel,
  reasoningModel,
  teaEvaluatorModel,
  titleModel,
} from './models.test';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        [MODEL_IDS.CHAT_MODEL]: chatModel,
        [MODEL_IDS.CHAT_MODEL_REASONING]: reasoningModel,
        [MODEL_IDS.TITLE_MODEL]: titleModel,
        [MODEL_IDS.ARTIFACT_MODEL]: artifactModel,
        [MODEL_IDS.TEA_EVALUATOR]: teaEvaluatorModel,
        [MODEL_IDS.ELPAC_EVALUATOR]: elpacEvaluatorModel,
      },
    })
  : customProvider({
      languageModels: {
        // Use OpenAI models for chat and evaluators
        [MODEL_IDS.CHAT_MODEL]: openai('gpt-4o'),
        [MODEL_IDS.CHAT_MODEL_REASONING]: wrapLanguageModel({
          model: openai('o1-mini'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        [MODEL_IDS.TITLE_MODEL]: openai('gpt-4o-mini'),
        [MODEL_IDS.ARTIFACT_MODEL]: openai('gpt-4o'),
        [MODEL_IDS.TEA_EVALUATOR]: openai('gpt-4o'),
        [MODEL_IDS.ELPAC_EVALUATOR]: openai('gpt-4o'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
