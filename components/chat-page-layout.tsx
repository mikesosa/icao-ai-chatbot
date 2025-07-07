'use client';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ExamSidebar } from '@/components/exam-interface';
import { useExamContext } from '@/hooks/use-exam-context';
import { Session } from 'next-auth';
import type { UIMessage } from 'ai';

interface ChatPageLayoutProps {
  session: Session;
  id: string;
  modelId: string;
  initialMessages: UIMessage[];
  modelType?: string;
  initialVisibilityType: 'private' | 'public';
  isReadonly: boolean;
  autoResume: boolean;
}

export function ChatPageLayout({
  session,
  id,
  modelId,
  initialMessages,
  modelType,
  initialVisibilityType,
  isReadonly,
  autoResume,
}: ChatPageLayoutProps) {
  const { examType } = useExamContext();

  return (
    <div className="flex">
      <div className="flex-1 flex flex-col">
        <Chat
          key={id}
          id={id}
          modelType={modelType}
          initialMessages={initialMessages}
          initialChatModel={modelId}
          initialVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
          autoResume={autoResume}
        />
        <DataStreamHandler id={id} />
      </div>
      {examType && (
        <div className="flex flex-col min-w-0 h-dvh bg-sidebar">
          <ExamSidebar initialMessages={initialMessages} />
        </div>
      )}
    </div>
  );
}
