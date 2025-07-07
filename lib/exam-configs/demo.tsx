import React from 'react';
import {
  ExamSidebar,
  TEA_EXAM_CONFIG,
  ELPAC_EXAM_CONFIG,
  getExamConfigById,
} from '@/components/exam-interface';
import type { UIMessage } from 'ai';

/**
 * Demo file showing how to use the new dynamic exam system
 * This demonstrates how different exam types can be used with the same components
 */

// Example 1: Using TEA exam configuration
export function TeaExamDemo() {
  const initialMessages: UIMessage[] = [];

  return (
    <ExamSidebar
      initialMessages={initialMessages}
      examConfig={TEA_EXAM_CONFIG}
    />
  );
}

// Example 2: Using ELPAC exam configuration
export function ElpacExamDemo() {
  const initialMessages: UIMessage[] = [];

  return (
    <ExamSidebar
      initialMessages={initialMessages}
      examConfig={ELPAC_EXAM_CONFIG}
    />
  );
}

// Example 3: Dynamic exam loading based on ID
export function DynamicExamDemo({ examId }: { examId: string }) {
  const initialMessages: UIMessage[] = [];
  const examConfig = getExamConfigById(examId);

  if (!examConfig) {
    return <div>Exam configuration not found for ID: {examId}</div>;
  }

  return (
    <ExamSidebar initialMessages={initialMessages} examConfig={examConfig} />
  );
}

// Example 4: How to create a custom exam configuration
export function CustomExamDemo() {
  const initialMessages: UIMessage[] = [];

  // Example of creating a custom exam configuration
  const customExamConfig = {
    id: 'custom-exam',
    name: 'Custom Language Test',
    examConfig: {
      name: 'Custom Language Test',
      sections: {
        1: { name: 'Grammar', duration: 15 * 60, color: 'bg-blue-500' },
        2: { name: 'Vocabulary', duration: 20 * 60, color: 'bg-green-500' },
        3: { name: 'Comprehension', duration: 25 * 60, color: 'bg-purple-500' },
        4: { name: 'Writing', duration: 30 * 60, color: 'bg-orange-500' },
        5: { name: 'Speaking', duration: 15 * 60, color: 'bg-red-500' },
      },
    },
    controlsConfig: {
      name: 'Custom Language Test',
      totalSections: 5,
      sections: [
        {
          number: 1,
          title: 'Grammar',
          description: 'Test your grammar knowledge',
          icon: <span>📝</span>,
          duration: '15 min',
        },
        {
          number: 2,
          title: 'Vocabulary',
          description: 'Expand your vocabulary',
          icon: <span>📚</span>,
          duration: '20 min',
        },
        {
          number: 3,
          title: 'Comprehension',
          description: 'Reading comprehension tasks',
          icon: <span>📖</span>,
          duration: '25 min',
        },
        {
          number: 4,
          title: 'Writing',
          description: 'Writing exercises',
          icon: <span>✍️</span>,
          duration: '30 min',
        },
        {
          number: 5,
          title: 'Speaking',
          description: 'Oral communication test',
          icon: <span>🗣️</span>,
          duration: '15 min',
        },
      ],
      totalDuration: '105 minutes',
      startButtonText: 'Start Custom Test',
      finishButtonText: 'Complete Test',
    },
    messagesConfig: {
      welcomeMessage: 'Welcome to the Custom Language Test!',
      sectionStartMessages: {
        1: 'Section 1: Grammar - Test your grammar knowledge',
        2: 'Section 2: Vocabulary - Expand your vocabulary',
        3: 'Section 3: Comprehension - Reading comprehension tasks',
        4: 'Section 4: Writing - Writing exercises',
        5: 'Section 5: Speaking - Oral communication test',
      },
      completionMessage:
        'Congratulations! You have completed the Custom Language Test.',
      quickInstructions: [
        'Read all instructions carefully',
        'Take your time to answer',
        'Use examples when appropriate',
        'Stay focused throughout the test',
      ],
    },
  };

  return (
    <ExamSidebar
      initialMessages={initialMessages}
      examConfig={customExamConfig}
    />
  );
}

/**
 * Benefits of the new dynamic system:
 *
 * 1. **Flexibility**: Each exam can have different numbers of sections, durations, and content
 * 2. **Reusability**: Same components work for any exam type
 * 3. **Maintainability**: Each exam config is in its own file
 * 4. **Extensibility**: Easy to add new exam types without modifying existing code
 * 5. **Type Safety**: Full TypeScript support with proper typing
 *
 * To add a new exam type:
 * 1. Create a new file in lib/exam-configs/ (e.g., toefl.tsx)
 * 2. Export the configuration following the CompleteExamConfig interface
 * 3. Add the export to lib/exam-configs/index.ts
 * 4. Update the getExamConfigById function to include the new exam
 * 5. Add the new exam ID to AVAILABLE_EXAMS array
 */
