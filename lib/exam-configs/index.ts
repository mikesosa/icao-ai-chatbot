// Base exam configuration types
export type ExamSection = number;

export interface ExamSectionConfig {
  name: string;
  duration: number; // en segundos
  color: string;
}

export interface ExamConfig {
  name: string;
  sections: Record<ExamSection, ExamSectionConfig>;
}

export interface ExamSectionInfo {
  number: ExamSection;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: string;
}

export interface ExamControlsConfig {
  name: string;
  totalSections: number;
  sections: ExamSectionInfo[];
  totalDuration: string;
  startButtonText: string;
  finishButtonText: string;
}

export interface ExamMessagesConfig {
  welcomeMessage: string;
  sectionStartMessages: Record<ExamSection, string>;
  completionMessage: string;
  quickInstructions: string[];
}

// Complete exam configuration that includes all aspects
export interface CompleteExamConfig {
  id: string;
  name: string;
  examConfig: ExamConfig;
  controlsConfig: ExamControlsConfig;
  messagesConfig: ExamMessagesConfig;
}

// Export exam configurations
export { TEA_EXAM_CONFIG } from './tea';
export { ELPAC_EXAM_CONFIG } from './elpac';

// Utility to get exam config by ID
export const getExamConfigById = (id: string): CompleteExamConfig | undefined => {
  // Dynamic import based on ID
  switch (id) {
    case 'tea-evaluator':
      return require('./tea').TEA_EXAM_CONFIG;
    case 'elpac-evaluator':
      return require('./elpac').ELPAC_EXAM_CONFIG;
    default:
      return undefined;
  }
};

// List of available exam types
export const AVAILABLE_EXAMS = ['tea', 'elpac'] as const;
export type ExamType = typeof AVAILABLE_EXAMS[number]; 