'use client';

import { useSidebar } from '@/components/ui/sidebar';
import { MODEL_IDS, MODEL_TYPES } from '@/lib/types';
import { createContext, useState, ReactNode } from 'react';

// Define the exam context interface
interface ExamContextType {
  // Exam state
  examStarted: boolean;
  examType: string | null;
  examStartTime: Date | null;
  examDuration: number | null; // in minutes
  currentSection: string | null;
  currentSubsection: string | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  totalSections: number; // Dynamic total sections from exam config

  // Exam progress
  completedSections: string[];
  completedSubsections: string[];
  examProgress: number; // percentage 0-100

  // Exam actions
  readyToStartExam: (modelId: string) => void;
  startExam: (
    modelId: string,
    duration?: number,
    totalSections?: number,
  ) => void;
  endExam: () => void;
  setCurrentSection: (section: string) => void;
  setCurrentSubsection: (subsection: string | null) => void;
  setCurrentQuestion: (index: number) => void;
  setTotalQuestions: (total: number) => void;
  setTotalSections: (total: number) => void;
  completeSection: (section: string) => void;
  completeSubsection: (subsection: string) => void;
  updateProgress: (progress: number) => void;

  // AI-driven exam control
  handleAIExamControl: (
    action: 'complete_and_advance' | 'complete_current' | 'advance_to_section',
    targetSection?: string,
  ) => void;

  // Exam utilities
  isExamModel: (modelId: string) => boolean;
  getExamDuration: () => number | null;
  getTimeRemaining: () => number | null; // in minutes
  getExamTitle: () => string | null;
}

export const ExamContext = createContext<ExamContextType | undefined>(
  undefined,
);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [examStarted, setExamStarted] = useState(false);
  const [examType, setExamType] = useState<string | null>(null);
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const [examDuration, setExamDuration] = useState<number | null>(null);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [currentSubsection, setCurrentSubsection] = useState<string | null>(
    null,
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [completedSubsections, setCompletedSubsections] = useState<string[]>(
    [],
  );
  const [examProgress, setExamProgress] = useState(0);
  const { setOpen } = useSidebar();

  const readyToStartExam = (modelId: string) => {
    if (isExamModel(modelId)) {
      setExamType(modelId);
      setOpen(false);
    }
  };

  const isExamModel = (modelId: string): boolean => {
    // Check if the model ends with '-evaluator' to identify exam models dynamically
    return modelId.endsWith('-evaluator');
  };

  const startExam = (
    modelId: string,
    duration = 180,
    totalSectionsCount = 3,
  ) => {
    // default 3 hours, 3 sections
    if (isExamModel(modelId)) {
      setExamStarted(true);
      setExamType(modelId);
      setExamStartTime(new Date());
      setExamDuration(duration);
      setTotalSections(totalSectionsCount);
      setCurrentSection(null);
      setCurrentSubsection(null);
      setCurrentQuestionIndex(0);
      setTotalQuestions(0);
      setCompletedSections([]);
      setCompletedSubsections([]);
      setExamProgress(0);
    }
  };

  const endExam = () => {
    setExamStarted(false);
    setExamType(null);
    setExamStartTime(null);
    setExamDuration(null);
    setTotalSections(0);
    setCurrentSection(null);
    setCurrentSubsection(null);
    setCurrentQuestionIndex(0);
    setTotalQuestions(0);
    setCompletedSections([]);
    setCompletedSubsections([]);
    setExamProgress(0);
  };

  const completeSection = (section: string) => {
    setCompletedSections((prev) => {
      if (!prev.includes(section)) {
        return [...prev, section];
      }
      return prev;
    });
  };

  const completeSubsection = (subsection: string) => {
    setCompletedSubsections((prev) => {
      if (!prev.includes(subsection)) {
        return [...prev, subsection];
      }
      return prev;
    });
  };

  const updateProgress = (progress: number) => {
    setExamProgress(Math.min(Math.max(progress, 0), 100));
  };

  const getExamDuration = (): number | null => {
    return examDuration;
  };

  const getTimeRemaining = (): number | null => {
    if (!examStartTime || !examDuration) return null;

    const now = new Date();
    const elapsedMinutes = Math.floor(
      (now.getTime() - examStartTime.getTime()) / (1000 * 60),
    );
    const remaining = examDuration - elapsedMinutes;

    return Math.max(remaining, 0);
  };

  const getExamTitle = (): string | null => {
    if (!examType) return null;

    // Generate a title based on the exam type
    // Remove '-evaluator' suffix and format the name
    const baseName = examType.replace('-evaluator', '');
    const formattedName = baseName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `${formattedName} Assessment`;
  };

  const handleAIExamControl = (
    action: 'complete_and_advance' | 'complete_current' | 'advance_to_section',
    targetSection?: string,
  ) => {
    const currentSectionNum = parseInt(currentSection || '1');

    switch (action) {
      case 'complete_current':
        if (currentSection) {
          completeSection(currentSection);
        }
        break;

      case 'complete_and_advance':
        if (currentSection) {
          completeSection(currentSection);

          // Advance to next section if possible (use dynamic totalSections)
          const nextSection = currentSectionNum + 1;

          if (nextSection <= totalSections) {
            setCurrentSection(nextSection.toString());
            setCurrentSubsection(null); // Reset subsection when changing sections
          } else {
            console.warn(
              '⚠️ [EXAM CONTEXT] Cannot advance: next section exceeds total sections',
            );
          }
        }
        break;

      case 'advance_to_section':
        if (targetSection) {
          const targetSectionNum = parseInt(targetSection);

          // Validate target section is within bounds
          if (targetSectionNum >= 1 && targetSectionNum <= totalSections) {
            setCurrentSection(targetSection);
            setCurrentSubsection(null); // Reset subsection when changing sections
          } else {
            console.warn(
              '⚠️ [EXAM CONTEXT] Invalid target section:',
              targetSectionNum,
            );
          }
        }
        break;
    }
  };

  const contextValue: ExamContextType = {
    examStarted,
    examType,
    examStartTime,
    examDuration,
    currentSection,
    currentSubsection,
    currentQuestionIndex,
    totalQuestions,
    totalSections,
    completedSections,
    completedSubsections,
    examProgress,
    readyToStartExam,
    startExam,
    endExam,
    setCurrentSection,
    setCurrentSubsection,
    setCurrentQuestion: setCurrentQuestionIndex,
    setTotalQuestions,
    setTotalSections,
    completeSection,
    completeSubsection,
    updateProgress,
    handleAIExamControl,
    isExamModel,
    getExamDuration,
    getTimeRemaining,
    getExamTitle,
  };

  return (
    <ExamContext.Provider value={contextValue}>{children}</ExamContext.Provider>
  );
}
