'use client';

import {
  type ReactNode,
  createContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  AudioFile,
  CompleteExamConfig,
} from '@/components/exam-interface/exam';
import { useSidebar } from '@/components/ui/sidebar';

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
  examConfig: CompleteExamConfig | null; // Add exam configuration

  // Audio state
  currentAudioIndex: number;
  audioFiles: AudioFile[];
  isAudioPlaying: boolean;
  audioProgress: number; // 0-100
  activeAudioPlayerId: string | null;

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
  setExamConfig: (config: CompleteExamConfig | null) => void; // Add setter for exam config
  completeSection: (section: string) => void;
  completeSubsection: (subsection: string) => void;
  updateProgress: (progress: number) => void;

  // Audio actions
  setAudioFiles: (files: AudioFile[]) => void;
  setCurrentAudioIndex: (index: number) => void;
  setIsAudioPlaying: (playing: boolean) => void;
  setAudioProgress: (progress: number) => void;
  setActiveAudioPlayerId: (id: string | null) => void;
  playNextAudio: () => void;
  playPreviousAudio: () => void;
  getCurrentAudioFile: () => AudioFile | null;
  getAudioUrl: (recording: number) => string;

  // AI-driven exam control
  handleAIExamControl: (
    action:
      | 'advance_to_next'
      | 'complete_and_advance'
      | 'complete_current'
      | 'advance_to_section'
      | 'complete_exam',
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
  const [examConfig, setExamConfig] = useState<CompleteExamConfig | null>(null); // Add exam config state

  // Audio state
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activeAudioPlayerId, setActiveAudioPlayerId] = useState<string | null>(
    null,
  );

  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [completedSubsections, setCompletedSubsections] = useState<string[]>(
    [],
  );
  const [examProgress, setExamProgress] = useState(0);
  const { setOpen } = useSidebar();

  // Add debouncing for exam control to prevent rapid duplicate calls
  const lastExamControlCall = useRef<{ action: string; timestamp: number }>({
    action: '',
    timestamp: 0,
  });

  // Add a flag to prevent multiple simultaneous calls
  const isProcessingExamControl = useRef(false);

  // Debug logging for exam state changes
  useEffect(() => {
    console.log('🔍 [EXAM CONTEXT] State changed:', {
      examStarted,
      currentSection,
      currentSubsection,
      examType,
    });
  }, [examStarted, currentSection, currentSubsection, examType]);

  // Auto-select first subsection when section changes
  useEffect(() => {
    if (examStarted && currentSection && !currentSubsection && examConfig) {
      const sectionConfig =
        examConfig.examConfig.sections[Number(currentSection)];
      if (sectionConfig?.subsections) {
        const subsectionKeys = Object.keys(sectionConfig.subsections).sort();
        if (subsectionKeys.length > 0) {
          console.log(
            '🎯 [EXAM CONTEXT] Auto-selecting first subsection:',
            subsectionKeys[0],
          );
          setCurrentSubsection(subsectionKeys[0]);
        }
      }
    }
  }, [
    examStarted,
    currentSection,
    currentSubsection,
    examConfig,
    setCurrentSubsection,
  ]);

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
    console.log('🔚 [EXAM CONTEXT] endExam() called - terminating exam');
    console.log('🔚 [EXAM CONTEXT] Current state before termination:', {
      examStarted,
      examType,
      currentSection,
      currentSubsection,
    });

    // Only end exam if explicitly requested or all sections are complete
    if (!examStarted) {
      console.log('🚫 [EXAM CONTEXT] Exam not started, ignoring endExam call');
      return;
    }

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
    setExamConfig(null); // Reset exam config
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

  // Audio functions
  const playNextAudio = () => {
    if (currentAudioIndex < audioFiles.length - 1) {
      setCurrentAudioIndex(currentAudioIndex + 1);
    }
  };

  const playPreviousAudio = () => {
    if (currentAudioIndex > 0) {
      setCurrentAudioIndex(currentAudioIndex - 1);
    }
  };

  const getCurrentAudioFile = (): AudioFile | null => {
    return audioFiles[currentAudioIndex] || null;
  };

  const getAudioUrl = (recording: number): string => {
    if (!examType || !currentSection || !currentSubsection) {
      return '';
    }

    const exam = examType.replace('-evaluator', '');
    const section = currentSection;
    const subsection = currentSubsection;

    // For TEA exam, combine section and subsection properly
    // Section 2 with subsection 2A should become "2a"
    const sectionParam =
      exam === 'tea' && section === '2'
        ? `2${subsection.toLowerCase().replace('2', '')}`
        : section;

    return `/api/audio?exam=${exam}&section=${sectionParam}&recording=${recording}`;
  };

  // Helper function to get the next subsection in sequence using exam configuration
  const getNextSubsection = (
    currentSubsection: string,
    sectionKey: string | null | undefined,
  ): string | null => {
    if (!sectionKey || !examConfig) return null;

    // Get section configuration safely using Object.hasOwn for type safety
    const sections = examConfig.examConfig.sections;
    if (!sections || !Object.hasOwn(sections, sectionKey)) return null;

    const sectionConfig = (sections as Record<string, any>)[sectionKey];
    if (!sectionConfig || !sectionConfig.subsections) return null;

    // Get all subsection keys for this section and sort them
    const subsectionKeys = Object.keys(sectionConfig.subsections).sort();

    // Find the current subsection index
    const currentIndex = subsectionKeys.indexOf(currentSubsection);

    // If current subsection not found or is the last one, return null
    if (currentIndex === -1 || currentIndex === subsectionKeys.length - 1) {
      return null;
    }

    // Return the next subsection
    return subsectionKeys[currentIndex + 1];
  };

  const handleAIExamControl = (
    action:
      | 'advance_to_next'
      | 'complete_and_advance'
      | 'complete_current'
      | 'advance_to_section'
      | 'complete_exam',
    targetSection?: string,
  ) => {
    // Prevent multiple simultaneous calls
    if (isProcessingExamControl.current) {
      console.log(
        '🚫 [EXAM CONTEXT] Ignoring action - already processing:',
        action,
      );
      return;
    }

    // Ignore all exam control actions if exam is not started (except complete_exam which can be called anytime)
    if (!examStarted && action !== 'complete_exam') {
      console.log(
        '🚫 [EXAM CONTEXT] Ignoring action - exam not started:',
        action,
      );
      return;
    }

    // Prevent exam termination unless explicitly requested
    if (action === 'complete_exam' && !examStarted) {
      console.log(
        '🚫 [EXAM CONTEXT] Ignoring complete_exam - exam not started:',
        action,
      );
      return;
    }

    // Debounce rapid duplicate calls (within 2 seconds for same action, 10 seconds for different actions)
    const now = Date.now();
    const timeSinceLastCall = now - lastExamControlCall.current.timestamp;
    const isSameAction = lastExamControlCall.current.action === action;
    const debounceTime = isSameAction ? 2000 : 10000; // 2s for same action, 10s for different

    // Log only when we will ignore (to reduce noise)
    if (timeSinceLastCall < debounceTime) {
      console.log('🔍 [EXAM CONTEXT] Debounce check:', {
        action,
        timeSinceLastCall,
        willIgnore: true,
        debounceTime,
      });
    }

    if (timeSinceLastCall < debounceTime) {
      console.log(
        '🚫 [EXAM CONTEXT] Ignoring duplicate call:',
        action,
        `(${timeSinceLastCall}ms ago)`,
      );
      return;
    }

    // Prevent any other actions once complete_exam has been called
    if (
      lastExamControlCall.current.action === 'complete_exam' &&
      action !== 'complete_exam'
    ) {
      console.log(
        '🚫 [EXAM CONTEXT] Ignoring action - exam already completed:',
        action,
      );
      return;
    }

    // Set processing flag
    isProcessingExamControl.current = true;

    // Update last call tracking
    lastExamControlCall.current = { action, timestamp: now };

    const currentSectionNum = Number.parseInt(currentSection || '1');

    switch (action) {
      case 'complete_current':
        if (currentSection) {
          completeSection(currentSection);
        }
        break;

      case 'advance_to_next':
        // Smart progression: advance to next subsection first, then to next section
        if (currentSubsection) {
          // Currently in a subsection, try to advance to next subsection
          const nextSubsection = getNextSubsection(
            currentSubsection,
            currentSection,
          );

          if (nextSubsection) {
            console.log(
              '✅ [EXAM CONTEXT] Advancing to next subsection:',
              nextSubsection,
            );
            setCurrentSubsection(nextSubsection);

            // Add cooldown to prevent rapid progression
            setTimeout(() => {
              isProcessingExamControl.current = false;
            }, 3000); // 3 second cooldown after subsection change
            return; // Early return to prevent further processing
          } else {
            // No more subsections in current section, advance to next section
            const nextSection = currentSectionNum + 1;
            if (nextSection <= totalSections) {
              console.log(
                '✅ [EXAM CONTEXT] Advancing from section',
                currentSection,
                'to section',
                nextSection,
              );
              setCurrentSection(nextSection.toString());
              setCurrentSubsection(null); // Will be auto-selected by useEffect

              // Add cooldown to prevent rapid progression
              setTimeout(() => {
                isProcessingExamControl.current = false;
              }, 3000); // 3 second cooldown after section change
              return; // Early return to prevent further processing
            } else {
              console.warn(
                '⚠️ [EXAM CONTEXT] Cannot advance: reached final section',
              );
            }
          }
        } else if (currentSection) {
          // Currently in a section without subsections, advance to next section
          const nextSection = currentSectionNum + 1;
          if (nextSection <= totalSections) {
            console.log(
              '✅ [EXAM CONTEXT] Advancing from section',
              currentSection,
              'to section',
              nextSection,
            );
            setCurrentSection(nextSection.toString());
            setCurrentSubsection(null); // Will be auto-selected by useEffect

            // Add cooldown to prevent rapid progression
            setTimeout(() => {
              isProcessingExamControl.current = false;
            }, 3000); // 3 second cooldown after section change
            return; // Early return to prevent further processing
          } else {
            console.warn(
              '⚠️ [EXAM CONTEXT] Cannot advance: reached final section',
            );
          }
        }
        break;

      case 'complete_and_advance':
        if (currentSection) {
          completeSection(currentSection);

          // Advance to next section if possible (use dynamic totalSections)
          const nextSection = currentSectionNum + 1;

          if (nextSection <= totalSections) {
            console.log(
              '✅ [EXAM CONTEXT] Advancing from section',
              currentSection,
              'to section',
              nextSection,
            );
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
          const targetSectionNum = Number.parseInt(targetSection);

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

      case 'complete_exam': {
        // Only allow exam completion if explicitly requested or all sections are done
        console.log('🔍 [EXAM CONTEXT] Complete exam requested:', {
          currentSection,
          totalSections,
          completedSections,
        });

        // Mark current section as complete
        if (currentSection) {
          completeSection(currentSection);
        }

        // Only end exam if all sections are complete or explicitly requested
        const allSectionsComplete = completedSections.length >= totalSections;
        if (allSectionsComplete) {
          console.log('✅ [EXAM CONTEXT] All sections complete, ending exam');
          endExam();
        } else {
          console.log(
            '⚠️ [EXAM CONTEXT] Exam not complete, ignoring endExam call',
          );
        }
        break;
      }
    }

    // Clear processing flag
    isProcessingExamControl.current = false;
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
    examConfig, // Add exam config to context value
    currentAudioIndex,
    audioFiles,
    isAudioPlaying,
    audioProgress,
    activeAudioPlayerId,
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
    setExamConfig, // Add exam config setter to context value
    completeSection,
    completeSubsection,
    updateProgress,
    setAudioFiles,
    setCurrentAudioIndex,
    setIsAudioPlaying,
    setAudioProgress,
    setActiveAudioPlayerId,
    playNextAudio,
    playPreviousAudio,
    getCurrentAudioFile,
    getAudioUrl,
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
