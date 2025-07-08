// Types that match the API response (serialized data)
export interface SerializedExamSectionConfig {
  name: string;
  duration: number; // in seconds
  color: string;
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
  completionMessage: string;
  quickInstructions: string[];
}

export interface SerializedCompleteExamConfig {
  id: string;
  name: string;
  examConfig: SerializedExamConfig;
  controlsConfig: SerializedExamControlsConfig;
  messagesConfig: SerializedExamMessagesConfig;
}

// Frontend types (with React components)
export type ExamSection = number;

export interface ExamSectionConfig {
  name: string;
  duration: number; // in seconds
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
  completionMessage: string;
  quickInstructions: string[];
}

export interface CompleteExamConfig {
  id: string;
  name: string;
  examConfig: ExamConfig;
  controlsConfig: ExamControlsConfig;
  messagesConfig: ExamMessagesConfig;
}
