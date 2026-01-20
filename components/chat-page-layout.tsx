'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import type { Session } from 'next-auth';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ExamSidebar } from '@/components/exam-interface/exam-sidebar';
import { useExamConfig } from '@/hooks/use-exam-configs';
import { useExamContext } from '@/hooks/use-exam-context';

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
  const { examType, setExamConfig } = useExamContext();
  const { config: examConfig } = useExamConfig(examType);

  // Track the last examConfig id to prevent duplicate setExamConfig calls
  const lastExamConfigId = useRef<string | null>(null);

  // Set exam configuration in context when it's loaded (only if id changed)
  useEffect(() => {
    if (examConfig && examConfig.id !== lastExamConfigId.current) {
      lastExamConfigId.current = examConfig.id;
      setExamConfig(examConfig);
    }
  }, [examConfig, setExamConfig]);

  // Create refs to store the data stream
  const [dataStream, setDataStream] = useState<any[]>([]);

  // Use a ref for append to avoid re-render loops
  const appendRef = useRef<UseChatHelpers['append'] | null>(null);
  // Force re-render once when append becomes available
  const [appendReady, setAppendReady] = useState(false);

  // Stable callback for receiving append from Chat
  const handleAppendRef = useCallback((a: UseChatHelpers['append']) => {
    if (appendRef.current !== a) {
      appendRef.current = a;
      setAppendReady(true);
    }
  }, []);

  // Stable callback for data stream updates
  const handleDataStreamUpdate = useCallback((data: any[]) => {
    setDataStream(data || []);
  }, []);

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
          onAppendRef={handleAppendRef}
          onDataStreamUpdate={handleDataStreamUpdate}
        />
        <DataStreamHandler id={id} dataStream={dataStream} />
      </div>
      {examConfig && (
        <div className="flex flex-col min-w-0 h-dvh bg-sidebar">
          <ExamSidebar
            examConfig={examConfig}
            append={appendReady ? appendRef.current || undefined : undefined}
          />
        </div>
      )}
    </div>
  );
}
