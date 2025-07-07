// Re-export all exam interface components
export { ExamSidebar } from './exam-sidebar';
export { ExamSectionControls } from './exam-section-controls';
export { ExamTimer } from './exam-timer';

// Re-export types from the centralized config
export type {
  ExamSection,
  ExamConfig,
  ExamSectionInfo,
  ExamControlsConfig,
  ExamMessagesConfig,
  CompleteExamConfig,
  ExamType,
} from '@/lib/exam-configs';

// Re-export exam configurations
export {
  TEA_EXAM_CONFIG,
  ELPAC_EXAM_CONFIG,
  getExamConfigById,
  AVAILABLE_EXAMS,
} from '@/lib/exam-configs';
