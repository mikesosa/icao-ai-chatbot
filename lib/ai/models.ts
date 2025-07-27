import { examConfigService } from '@/lib/services/exam-config-service';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

// Generate models synchronously from fallback data (for SSR)
function generateModelsFromFallbackConfigs(): Array<ChatModel> {
  try {
    const examConfigs = examConfigService.getConfigurationsSync();
    return examConfigService.generateChatModels(examConfigs);
  } catch (error) {
    console.error('Error generating models from fallback configs:', error);
    // Return hardcoded fallback models
    return examConfigService.getFallbackChatModels();
  }
}

// Export synchronous models (from fallback data for SSR)
export const chatModels: Array<ChatModel> = generateModelsFromFallbackConfigs();

// Generate models from provided configurations (for client-side SWR data)
export function generateChatModelsFromConfigs(
  configs: Record<string, any>,
): Array<ChatModel> {
  try {
    return examConfigService.generateChatModels(configs);
  } catch (error) {
    console.error('Error generating models from provided configs:', error);
    return examConfigService.getFallbackChatModels();
  }
}

// Default to the first available exam model
export const DEFAULT_CHAT_MODEL: string =
  chatModels.length > 0 ? chatModels[0].id : 'tea-evaluator';
