'use client';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ExamSidebar } from '@/components/exam-interface/exam-sidebar';
import { fetcher } from '@/lib/utils';

import { useExamContext } from '@/hooks/use-exam-context';
import { Session } from 'next-auth';
import type { UIMessage } from 'ai';
import useSWR from 'swr';
import { useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';

interface ChatPageLayoutProps {
  session: Session;
  id: string;
  modelId: string;
  initialMessages: UIMessage[];
  initialVisibilityType: 'private' | 'public';
  isReadonly: boolean;
  autoResume: boolean;
}

export function ChatPageLayout({
  session,
  id,
  modelId,
  initialMessages,
  initialVisibilityType,
  isReadonly,
  autoResume,
}: ChatPageLayoutProps) {
  const { examType } = useExamContext();
  const { data: examConfig } = useSWR(
    examType ? `/api/exam-configs?id=${examType}` : null,
    fetcher,
  );

  // Create a ref to store the chat's append function
  const appendRef = useRef<UseChatHelpers['append'] | null>(null);

  return (
    <div className="flex">
      <div className="flex-1 flex flex-col">
        <Chat
          key={id}
          id={id}
          initialMessages={
            initialMessages.length > 0
              ? initialMessages
              : examConfig?.messagesConfig.welcomeMessage
              ? [
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    content: examConfig.messagesConfig.welcomeMessage,
                    parts: [
                      {
                        type: 'text',
                        text: examConfig.messagesConfig.welcomeMessage,
                      },
                    ],
                  },
                ]
              : []
          }
          initialChatModel={modelId}
          initialVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
          autoResume={autoResume}
          onAppendRef={(append) => {
            appendRef.current = append;
          }}
        />
        <DataStreamHandler id={id} />
      </div>
      {examConfig && (
        <div className="flex flex-col min-w-0 h-dvh bg-sidebar">
          <ExamSidebar
            initialMessages={initialMessages}
            examConfig={examConfig}
            appendToChat={appendRef.current}
          />
        </div>
      )}
    </div>
  );
}
