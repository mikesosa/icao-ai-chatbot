// Types that match the API response (serialized data)
export interface SerializedExamSubsectionConfig {
  name: string;
  duration?: number; // in seconds, optional
  description: string;
  instructions?: string[];
}

// AI-specific configuration types
export interface SerializedAiSectionConfig {
  prompt: string;
  objectives: string[];
}

export interface SerializedAiConfig {
  mainPrompt: string;
  evaluationCriteria: string;
  sections: Record<string, SerializedAiSectionConfig>;
  finalEvaluationPrompt: string;
}

export interface SerializedExamSectionConfig {
  name: string;
  duration: number; // in seconds
  color: string;
  subsections?: Record<string, SerializedExamSubsectionConfig>; // optional subsections
}

export interface SerializedExamConfig {
  name: string;
  sections: Record<number, SerializedExamSectionConfig>;
}

export interface SerializedExamSectionInfo {
  number: number;
  title: string;
  description: string;
  icon: string; // Icon name as string
  duration: string;
}

export interface SerializedExamControlsConfig {
  name: string;
  totalSections: number;
  sections: SerializedExamSectionInfo[];
  totalDuration: string;
  startButtonText: string;
  finishButtonText: string;
}

export interface SerializedExamMessagesConfig {
  welcomeMessage: string;
  sectionStartMessages: Record<number, string>;
  subsectionStartMessages?: Record<string, string>; // optional subsection messages (e.g., "2A", "2B", "2C")
  completionMessage: string;
  quickInstructions: string[];
}

export interface SerializedCompleteExamConfig {
  id: string;
  name: string;
  aiConfig: SerializedAiConfig;
  examConfig: SerializedExamConfig;
  controlsConfig: SerializedExamControlsConfig;
  messagesConfig: SerializedExamMessagesConfig;
}

// Frontend types (with React components)
export type ExamSection = number;

export interface ExamSubsectionConfig {
  name: string;
  duration?: number; // in seconds, optional
  description: string;
  instructions?: string[];
}

// AI-specific configuration types (frontend)
export interface AiSectionConfig {
  prompt: string;
  objectives: string[];
}

export interface AiConfig {
  mainPrompt: string;
  evaluationCriteria: string;
  sections: Record<string, AiSectionConfig>;
  finalEvaluationPrompt: string;
}

export interface ExamSectionConfig {
  name: string;
  duration: number; // in seconds
  color: string;
  subsections?: Record<string, ExamSubsectionConfig>; // optional subsections
}

export interface ExamConfig {
  name: string;
  sections: Record<ExamSection, ExamSectionConfig>;
  
}

export interface ExamSectionInfo {
  number: ExamSection;
  title: string;
  description: string;
  icon: React.ReactNode; // React component
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
  subsectionStartMessages?: Record<string, string>; // optional subsection messages (e.g., "2A", "2B", "2C")
  completionMessage: string;
  quickInstructions: string[];
}

export interface CompleteExamConfig {
  id: string;
  name: string;
  aiConfig: AiConfig;
  examConfig: ExamConfig;
  controlsConfig: ExamControlsConfig;
  messagesConfig: ExamMessagesConfig;
}
