'use client';

import { useEffect, useRef } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { useExamContext } from '@/hooks/use-exam-context';

import { useSidebar } from '../ui/sidebar';

import type { CompleteExamConfig, ExamSection } from './exam';
import { ExamSectionControls } from './exam-section-controls';
import { ExamTimer } from './exam-timer';

interface ExamSidebarProps {
  examConfig: CompleteExamConfig;
  append?: UseChatHelpers['append'];
}

export function ExamSidebar({ examConfig, append }: ExamSidebarProps) {
  // Use exam context state instead of local state
  const { setOpen } = useSidebar();
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const _isAdmin = userType === 'admin';
  const allowJump = process.env.NODE_ENV === 'development';

  const {
    examStarted,
    currentSection,
    currentSubsection,
    completedSections,
    completedSubsections,
    setCurrentSection,
    setCurrentSubsection,
    completeSubsection,
    startExam,
    endExam,
    jumpToSection,
    jumpToSubsection,
  } = useExamContext();
  // Note: setExamConfig is called by ChatPageLayout (parent), not here

  // Track last appended subsection to prevent duplicates
  const lastAppendedSubsection = useRef<string | null>(null);

  // Track subsection changes for potential future use
  useEffect(() => {
    if (
      currentSubsection &&
      lastAppendedSubsection.current !== currentSubsection
    ) {
      lastAppendedSubsection.current = currentSubsection;
    }
  }, [currentSubsection]);

  // Exam handlers
  const handleStartExam = () => {
    startExam(
      examConfig.id,
      undefined,
      examConfig.controlsConfig.totalSections,
    );
    setCurrentSection('1');
    setCurrentSubsection(null);
    lastAppendedSubsection.current = null; // Reset tracking
    setOpen(false);

    toast.success(`Exam ${examConfig.name} started - Section 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    // In development we allow jumping (for debugging) and also notify chat via setOnSectionChange callback.
    if (allowJump) {
      jumpToSection(section.toString());
      toast.info(`[Dev] Jumped to Section ${section}`);
      return;
    }

    // Existing progressive lock logic for regular users
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) =>
      Number.parseInt(s),
    );

    // Progressive lock: Only allow going to completed sections or current section
    if (
      section > currentSectionNum &&
      !completedSectionNums.includes(section)
    ) {
      toast.warning(
        'Complete current section before advancing to future sections',
      );
      return;
    }

    // Real exam behavior: No navigation during active timing
    // Only allow reviewing completed sections
    if (
      section !== currentSectionNum &&
      !completedSectionNums.includes(section)
    ) {
      toast.warning('Section navigation is restricted during the exam');
      return;
    }

    // If navigating to a different completed section, show confirmation
    if (
      section !== currentSectionNum &&
      completedSectionNums.includes(section)
    ) {
      toast.info(`Reviewing completed Section ${section}`);
    }

    setCurrentSection(section.toString());
    setCurrentSubsection(null); // Reset subsection when changing sections

    toast.info(`Changed to Section ${section}`);
  };

  const handleSubsectionChange = (subsectionId: string) => {
    // In development we allow jumping (for debugging) and also notify chat via setOnSectionChange callback.
    if (allowJump) {
      jumpToSubsection(subsectionId);
      toast.info(`[Dev] Jumped to Subsection ${subsectionId}`);
      return;
    }

    // Existing progressive lock logic for regular users
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) =>
      Number.parseInt(s),
    );

    // Get the section number from subsection ID (e.g., "2A" -> section 2)
    const subsectionSection = Number.parseInt(subsectionId.charAt(0));

    // Progressive lock: Only allow subsections of completed sections or current section
    if (
      subsectionSection > currentSectionNum &&
      !completedSectionNums.includes(subsectionSection)
    ) {
      toast.warning(
        'Complete current section before accessing future subsections',
      );
      return;
    }

    // Real exam behavior: Only allow subsections within current or completed sections
    if (
      subsectionSection !== currentSectionNum &&
      !completedSectionNums.includes(subsectionSection)
    ) {
      toast.warning('Subsection navigation is restricted during the exam');
      return;
    }

    // Set subsection first to prevent auto-selection race condition
    setCurrentSubsection(subsectionId);

    // If navigating to a subsection of a different section, switch sections after
    if (subsectionSection !== currentSectionNum) {
      setCurrentSection(subsectionSection.toString());
    }

    // Track subsection change
    if (lastAppendedSubsection.current !== subsectionId) {
      lastAppendedSubsection.current = subsectionId;
    }

    toast.info(`Changed to Subsection ${subsectionId}`);
  };

  const handleEndExamRequest = (opts: { generateReport: boolean }) => {
    const total = examConfig.controlsConfig.totalSections;
    const done = completedSections.length;
    const endedEarly = done < total;

    // Request a partial evaluation before ending exam UI state
    if (opts.generateReport) {
      const examName = examConfig.name || 'exam';
      const evaluatorInstruction = endedEarly
        ? `I want to stop the ${examName} test now. I am ending the test early (not all parts are complete). Please provide a PARTIAL evaluation based ONLY on what you've observed so far. Clearly label it as INCOMPLETE / ENDED EARLY, and do not assume completion of missing parts.`
        : `I want to finish the ${examName} test now. Please provide the final evaluation based on my performance.`;

      // Use the chat append function if available (passed down from ChatPageLayout)
      if (append) {
        append({ role: 'user', content: evaluatorInstruction });
      } else {
        toast.warning(
          'Could not request evaluation report (chat not ready). Ending exam anyway.',
        );
      }
    }

    endExam();
    toast.success(
      opts.generateReport
        ? endedEarly
          ? 'Exam ended early — generating partial report...'
          : 'Exam completed — generating report...'
        : endedEarly
          ? 'Exam ended (no report generated)'
          : 'Exam completed successfully!',
    );
  };

  const handleSectionComplete = (section: ExamSection) => {
    completeSubsection(section.toString());
    toast.info(`Section ${section} completed`);
  };

  const handleTimerWarning = (section: ExamSection, timeLeft: number) => {
    toast.warning(
      `Section ${section}: Only ${Math.floor(timeLeft / 60)} minutes left`,
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {examStarted && (
        <ExamTimer
          currentSection={Number.parseInt(currentSection || '1') as ExamSection}
          examConfig={examConfig.examConfig}
          onSectionComplete={handleSectionComplete}
          onTimerWarning={handleTimerWarning}
        />
      )}

      <ExamSectionControls
        currentSection={Number.parseInt(currentSection || '1') as ExamSection}
        currentSubsection={currentSubsection}
        completedSections={
          completedSections.map((s) => Number.parseInt(s)) as ExamSection[]
        }
        completedSubsections={completedSubsections}
        onSectionChange={handleSectionChange}
        onSubsectionChange={handleSubsectionChange}
        onStartExam={handleStartExam}
        onEndExamRequest={handleEndExamRequest}
        examStarted={examStarted}
        controlsConfig={examConfig.controlsConfig}
        examConfig={examConfig}
      />
    </div>
  );
}
