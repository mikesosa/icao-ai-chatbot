'use client';

import { MODEL_IDS, MODEL_TYPES } from '@/lib/types';
import { createContext, useContext, useState, ReactNode } from 'react';

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

  // Exam progress
  completedSections: string[];
  completedSubsections: string[];
  examProgress: number; // percentage 0-100

  // Exam actions
  readyToStartExam: (modelId: string) => void;
  startExam: (modelId: string, duration?: number) => void;
  endExam: () => void;
  setCurrentSection: (section: string) => void;
  setCurrentSubsection: (subsection: string | null) => void;
  setCurrentQuestion: (index: number) => void;
  setTotalQuestions: (total: number) => void;
  completeSection: (section: string) => void;
  completeSubsection: (subsection: string) => void;
  updateProgress: (progress: number) => void;

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
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [completedSubsections, setCompletedSubsections] = useState<string[]>(
    [],
  );
  const [examProgress, setExamProgress] = useState(0);

  const readyToStartExam = (modelId: string) => {
    if (isExamModel(modelId)) {
      setExamType(modelId);
    }
  };

  const isExamModel = (modelId: string): boolean => {
    return (
      modelId === MODEL_IDS.TEA_EVALUATOR ||
      modelId === MODEL_IDS.ELPAC_EVALUATOR
    );
  };

  const startExam = (modelId: string, duration = 180) => {
    // default 3 hours
    if (isExamModel(modelId)) {
      setExamStarted(true);
      setExamType(modelId);
      setExamStartTime(new Date());
      setExamDuration(duration);
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

    switch (examType) {
      case MODEL_IDS.TEA_EVALUATOR:
        return 'Teacher Evaluation Assessment';
      case MODEL_IDS.ELPAC_EVALUATOR:
        return 'ELPAC Assessment';
      default:
        return 'Assessment';
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
    completeSection,
    completeSubsection,
    updateProgress,
    isExamModel,
    getExamDuration,
    getTimeRemaining,
    getExamTitle,
  };

  return (
    <ExamContext.Provider value={contextValue}>{children}</ExamContext.Provider>
  );
}
