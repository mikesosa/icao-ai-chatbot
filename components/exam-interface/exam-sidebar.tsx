'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ExamSectionControls } from './exam-section-controls';
import { ExamTimer } from './exam-timer';
import type { UIMessage } from 'ai';
import { useExamContext } from '@/hooks/use-exam-context';
import type { CompleteExamConfig, ExamSection } from './exam';
import { useSidebar } from '../ui/sidebar';
import type { UseChatHelpers } from '@ai-sdk/react';

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
  } = useExamContext();

  // Local state for UI
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // Chat messages with initial instructions
  const [messages, setMessages] = useState<UIMessage[]>(() => {
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
    startExam(examConfig.id);
    setShowInstructions(false);
    setIsTimerRunning(true);
    setCurrentSection('1');
    setCurrentSubsection(null);
    setOpen(false);

    toast.success(`Exam ${examConfig.name} started - Section 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    if (isTimerRunning) {
      toast.warning('Pause the timer before changing sections');
      return;
    }

    setCurrentSection(section.toString());
    setCurrentSubsection(null); // Reset subsection when changing sections

    // Send section start message to chat if appendToChat is available
    if (appendToChat && examConfig.messagesConfig.sectionStartMessages) {
      const sectionMessage =
        examConfig.messagesConfig.sectionStartMessages[section];
      if (sectionMessage) {
        appendToChat({
          role: 'user',
          content: sectionMessage,
        });
      }
    }

    toast.info(`Changed to Section ${section}`);
  };

  const handleSubsectionChange = (subsectionId: string) => {
    if (isTimerRunning) {
      toast.warning('Pause the timer before changing subsections');
      return;
    }

    setCurrentSubsection(subsectionId);

    const subsectionMessage =
      examConfig.messagesConfig.subsectionStartMessages?.[subsectionId];
    if (appendToChat && subsectionMessage) {
      appendToChat({
        role: 'user',
        content: subsectionMessage,
      });
    }

    toast.info(`Changed to Subsection ${subsectionId}`);
  };

  const handleEndExam = () => {
    setIsTimerRunning(false);
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

  const handleToggleTimer = () => {
    setIsTimerRunning((prev) => !prev);
  };

  const handleResetTimer = (section: ExamSection) => {
    setIsTimerRunning(false);
    toast.info(`Section ${section} timer reset`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {examStarted && (
        <ExamTimer
          currentSection={parseInt(currentSection || '1') as ExamSection}
          examConfig={examConfig.examConfig}
          onSectionComplete={handleSectionComplete}
          onTimerWarning={handleTimerWarning}
          isRunning={isTimerRunning}
          onToggleTimer={handleToggleTimer}
          onResetTimer={handleResetTimer}
        />
      )}

      <ExamSectionControls
        currentSection={parseInt(currentSection || '1') as ExamSection}
        currentSubsection={currentSubsection}
        completedSections={
          completedSections.map((s) => parseInt(s)) as ExamSection[]
        }
        completedSubsections={completedSubsections}
        onSectionChange={handleSectionChange}
        onSubsectionChange={handleSubsectionChange}
        onStartExam={handleStartExam}
        onEndExam={handleEndExam}
        examStarted={examStarted}
        isTimerRunning={isTimerRunning}
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
