import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
  teaEvaluatorModel,
  elpacEvaluatorModel,
} from './models.test';
import { MODEL_IDS } from '@/lib/types';

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
        [MODEL_IDS.CHAT_MODEL]: xai('grok-2-vision-1212'),
        [MODEL_IDS.CHAT_MODEL_REASONING]: wrapLanguageModel({
          model: xai('grok-3-mini-beta'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        [MODEL_IDS.TITLE_MODEL]: xai('grok-2-1212'),
        [MODEL_IDS.ARTIFACT_MODEL]: xai('grok-2-1212'),
        [MODEL_IDS.TEA_EVALUATOR]: xai('grok-2-1212'),
        [MODEL_IDS.ELPAC_EVALUATOR]: xai('grok-2-1212'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
