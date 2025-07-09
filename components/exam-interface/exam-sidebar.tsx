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
    setCurrentSection('1');
    setCurrentSubsection(null);
    setOpen(false);

    toast.success(`Exam ${examConfig.name} started - Section 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    const currentSectionNum = parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) => parseInt(s));

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
          role: 'user',
          content: sectionMessage,
        });
      }
    }

    toast.info(`Changed to Section ${section}`);
  };

  const handleSubsectionChange = (subsectionId: string) => {
    const currentSectionNum = parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) => parseInt(s));

    // Get the section number from subsection ID (e.g., "2A" -> section 2)
    const subsectionSection = parseInt(subsectionId.charAt(0));

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
          currentSection={parseInt(currentSection || '1') as ExamSection}
          examConfig={examConfig.examConfig}
          onSectionComplete={handleSectionComplete}
          onTimerWarning={handleTimerWarning}
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
