'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ExamSectionControls } from './exam-section-controls';
import type { UIMessage } from 'ai';
import { useExamContext } from '@/hooks/use-exam-context';
import type { CompleteExamConfig, ExamSection } from '@/lib/exam-configs';

interface ExamSidebarProps {
  initialMessages: UIMessage[];
  examConfig: CompleteExamConfig;
}

export function ExamSidebar({ initialMessages, examConfig }: ExamSidebarProps) {
  // Use exam context state instead of local state
  const {
    examStarted,
    currentSection,
    completedSections,
    setCurrentSection,
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
    setShowInstructions(false);
    setIsTimerRunning(true);

    // Send section 1 start message
    const sectionStartMessage: UIMessage = {
      id: `exam-section-1-start`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: examConfig.messagesConfig.sectionStartMessages[1],
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionStartMessage]);
    toast.success(`Examen ${examConfig.name} iniciado - Sección 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    if (isTimerRunning) {
      toast.warning('Pause el timer antes de cambiar de sección');
      return;
    }

    setCurrentSection(section.toString());

    // Send section change message
    const sectionMessage: UIMessage = {
      id: `exam-section-${section}-change`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: examConfig.messagesConfig.sectionStartMessages[section],
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionMessage]);
    toast.info(`Cambiado a Sección ${section}`);
  };

  const handleEndExam = () => {
    setIsTimerRunning(false);
    endExam();

    const finalMessage: UIMessage = {
      id: 'exam-complete',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: examConfig.messagesConfig.completionMessage,
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, finalMessage]);
    toast.success('¡Examen completado exitosamente!');
  };

  console.log('currentSection', currentSection);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Uncomment if you want to use the timer
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
      )} */}

      <ExamSectionControls
        currentSection={parseInt(currentSection || '1') as ExamSection}
        completedSections={
          completedSections.map((s) => parseInt(s)) as ExamSection[]
        }
        onSectionChange={handleSectionChange}
        onStartExam={handleStartExam}
        onEndExam={handleEndExam}
        examStarted={examStarted}
        isTimerRunning={isTimerRunning}
        controlsConfig={examConfig.controlsConfig}
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
