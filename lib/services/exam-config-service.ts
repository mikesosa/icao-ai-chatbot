// Import fallback data for server-side rendering
import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';
import type { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';
import { filterExamConfigs } from '@/lib/exam-configs/filter';

/**
 * Simplified exam config service that works with SWR
 * Provides fallbacks and utilities without duplicating fetch logic
 */
class ExamConfigService {
  /**
   * Get configurations synchronously from fallback data
   * Used for server-side rendering and initial hydration
   */
  getConfigurationsSync(): Record<string, SerializedCompleteExamConfig> {
    return filterExamConfigs(
      examConfigsData as Record<string, SerializedCompleteExamConfig>,
    );
  }

  /**
   * Get list of available exam IDs from fallback data
   */
  getAvailableExamIdsSync(): string[] {
    return Object.keys(this.getConfigurationsSync());
  }

  /**
   * Check if an exam ID is valid using fallback data
   */
  isValidExamIdSync(examId: string): boolean {
    return Object.keys(this.getConfigurationsSync()).includes(examId);
  }

  /**
   * Get a specific exam configuration from fallback data
   */
  getExamConfigurationSync(
    examId: string,
  ): SerializedCompleteExamConfig | null {
    const configs = this.getConfigurationsSync();
    return configs[examId] || null;
  }

  /**
   * Generate model IDs from configurations
   */
  generateModelIds(
    configs: Record<string, SerializedCompleteExamConfig>,
  ): Record<string, string> {
    const modelIds: Record<string, string> = {};
    Object.keys(configs).forEach((examId) => {
      modelIds[examId.toUpperCase().replace('-', '_')] = examId;
    });
    return modelIds;
  }

  /**
   * Generate chat models from configurations
   */
  generateChatModels(configs: Record<string, SerializedCompleteExamConfig>) {
    return Object.entries(configs).map(([examId, examConfig]) => ({
      id: examId,
      name: examConfig.name,
      description: `${examConfig.name} examination and evaluation system`,
    }));
  }

  /**
   * Get fallback model IDs for when no configurations are available
   */
  getFallbackModelIds(): string[] {
    return ['tea-demo', 'elpac-demo'];
  }

  /**
   * Get fallback chat models
   */
  getFallbackChatModels() {
    return [
      {
        id: 'tea-demo',
        name: 'TEA Demo',
        description: 'Short TEA demonstration exam and evaluation system',
      },
      {
        id: 'elpac-demo',
        name: 'ELPAC ATC Demo',
        description: 'Short ELPAC ATC demonstration exam and evaluation system',
      },
    ];
  }
}

// Export singleton instance
export const examConfigService = new ExamConfigService();
