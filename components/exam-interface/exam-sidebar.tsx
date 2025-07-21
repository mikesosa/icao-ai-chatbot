'use client';

import { useEffect, useRef, useState } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { toast } from 'sonner';

import { useExamContext } from '@/hooks/use-exam-context';

import { useSidebar } from '../ui/sidebar';

import type { CompleteExamConfig, ExamSection } from './exam';
import { ExamSectionControls } from './exam-section-controls';
import { ExamTimer } from './exam-timer';

interface ExamSidebarProps {
  initialMessages: UIMessage[];
  examConfig: CompleteExamConfig;
  appendToChat: UseChatHelpers['append'] | null;
}

export function ExamSidebar({
  initialMessages,
  examConfig,
  appendToChat,
}: ExamSidebarProps) {
  // Use exam context state instead of local state
  const { setOpen } = useSidebar();

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

  // Auto-append subsection message when subsection changes (including auto-selection)
  useEffect(() => {
    if (
      currentSubsection &&
      appendToChat &&
      examConfig.messagesConfig.subsectionStartMessages &&
      lastAppendedSubsection.current !== currentSubsection
    ) {
      const subsectionMessage =
        examConfig.messagesConfig.subsectionStartMessages[currentSubsection];
      console.log(
        '📝 [EXAM SIDEBAR] Auto-appending subsection message for',
        currentSubsection,
        ':',
        subsectionMessage,
      );
      if (subsectionMessage) {
        console.log(
          '📝 [EXAM SIDEBAR] Subsection message available but not appending to chat',
        );
        // Don't append instructions to chat - let AI provide them naturally
        // appendToChat({
        //   role: 'user',
        //   content: subsectionMessage,
        // });
        lastAppendedSubsection.current = currentSubsection;
      }
    }
  }, [
    currentSubsection,
    appendToChat,
    examConfig.messagesConfig.subsectionStartMessages,
  ]);

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

    // Send section start message to chat if appendToChat is available
    if (appendToChat && examConfig.messagesConfig.sectionStartMessages) {
      const sectionMessage =
        examConfig.messagesConfig.sectionStartMessages[section];
      if (sectionMessage) {
        appendToChat({
          role: 'assistant',
          content: sectionMessage,
        });
      }
    }

    toast.info(`Changed to Section ${section}`);
  };

  const handleSubsectionChange = (subsectionId: string) => {
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

    // If navigating to a subsection of a different section, switch sections first
    if (subsectionSection !== currentSectionNum) {
      setCurrentSection(subsectionSection.toString());
    }

    setCurrentSubsection(subsectionId);

    // Prevent duplicate message appending
    if (lastAppendedSubsection.current !== subsectionId) {
      const subsectionMessage =
        examConfig.messagesConfig.subsectionStartMessages?.[subsectionId];
      console.log(
        '📝 [EXAM SIDEBAR] Subsection message for',
        subsectionId,
        ':',
        subsectionMessage,
      );
      if (appendToChat && subsectionMessage) {
        console.log(
          '📝 [EXAM SIDEBAR] Subsection message available but not appending to chat',
        );
        // Don't append instructions to chat - let AI provide them naturally
        // appendToChat({
        //   role: 'user',
        //   content: subsectionMessage,
        // });
        lastAppendedSubsection.current = subsectionId;
      }
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
