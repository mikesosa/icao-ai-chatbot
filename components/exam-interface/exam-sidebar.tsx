'use client';

import { useEffect, useRef, useState } from 'react';

import type { UIMessage } from 'ai';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { useExamContext } from '@/hooks/use-exam-context';

import { useSidebar } from '../ui/sidebar';

import type { CompleteExamConfig, ExamSection } from './exam';
import { ExamSectionControls } from './exam-section-controls';
import { ExamTimer } from './exam-timer';

interface ExamSidebarProps {
  initialMessages: UIMessage[];
  examConfig: CompleteExamConfig;
}

export function ExamSidebar({ initialMessages, examConfig }: ExamSidebarProps) {
  // Use exam context state instead of local state
  const { setOpen } = useSidebar();
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';

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
    setExamConfig,
    jumpToSection,
    jumpToSubsection,
  } = useExamContext();

  // Set exam configuration in context when it's available
  useEffect(() => {
    if (examConfig) {
      setExamConfig(examConfig);
    }
  }, [examConfig, setExamConfig]);

  // Local state for UI
  const [_showInstructions, _setShowInstructions] = useState(true);

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

  // Chat messages with initial instructions
  const [_messages, _setMessages] = useState<UIMessage[]>(() => {
    if (initialMessages.length === 0) {
      return [
        {
          id: 'exam-welcome',
          role: 'assistant',
          content: '',
          parts: [
            {
              type: 'text',
              text: examConfig.messagesConfig.welcomeMessage,
            },
          ],
          createdAt: new Date(),
          experimental_attachments: [],
        },
      ];
    }
    return initialMessages;
  });

  // Exam handlers
  const handleStartExam = () => {
    startExam(
      examConfig.id,
      undefined,
      examConfig.controlsConfig.totalSections,
    );
    _setShowInstructions(false);
    setCurrentSection('1');
    setCurrentSubsection(null);
    lastAppendedSubsection.current = null; // Reset tracking
    setOpen(false);

    toast.success(`Exam ${examConfig.name} started - Section 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    // Use admin context method if admin, otherwise use regular logic
    if (isAdmin) {
      jumpToSection(section.toString());
      toast.info(`[Admin Mode] Jumped to Section ${section}`);
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
    // Use admin context method if admin, otherwise use regular logic
    if (isAdmin) {
      jumpToSubsection(subsectionId);
      toast.info(`[Admin Mode] Jumped to Subsection ${subsectionId}`);
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

  const handleEndExam = () => {
    endExam();
    toast.success('Exam completed successfully!');
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
        onEndExam={handleEndExam}
        examStarted={examStarted}
        controlsConfig={examConfig.controlsConfig}
        examConfig={examConfig}
      />

      {/* Uncomment if you want to show quick instructions
      {showInstructions && (
        <Card className="bg-sidebar">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="size-4" />
              Instrucciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {examConfig.messagesConfig.quickInstructions.map((instruction, index) => (
              <p key={index}>• {instruction}</p>
            ))}
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
