'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { SlidersHorizontal } from 'lucide-react';
import type { Session } from 'next-auth';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ExamSidebar } from '@/components/exam-interface/exam-sidebar';
import { ExamVoiceSession } from '@/components/exam-voice-session';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useExamConfig } from '@/hooks/use-exam-configs';
import { useExamContext } from '@/hooks/use-exam-context';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { examType, examStarted, setExamConfig } = useExamContext();
  const { config: examConfig } = useExamConfig(examType);
  const isMobile = useIsMobile();
  const [isExamSidebarOpen, setIsExamSidebarOpen] = useState(false);

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

  // Generate a stable welcome message ID that doesn't change on re-renders
  const welcomeMessageIdRef = useRef<string>(`welcome-${id}`);

  const resolvedInitialMessages = useMemo(() => {
    if (initialMessages.length > 0) {
      return initialMessages;
    }
    if (examConfig?.messagesConfig.welcomeMessage) {
      return [
        {
          id: welcomeMessageIdRef.current,
          role: 'assistant' as const,
          content: examConfig.messagesConfig.welcomeMessage,
          parts: [
            {
              type: 'text' as const,
              text: examConfig.messagesConfig.welcomeMessage,
            },
          ],
        } as UIMessage,
      ];
    }
    return [];
  }, [initialMessages, examConfig?.messagesConfig.welcomeMessage]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[chat-page-layout] resolvedInitialMessages', {
        count: resolvedInitialMessages.length,
        hasWelcome: Boolean(examConfig?.messagesConfig.welcomeMessage),
        initialProvided: initialMessages.length,
      });
    }
  }, [
    resolvedInitialMessages,
    examConfig?.messagesConfig.welcomeMessage,
    initialMessages.length,
  ]);

  useEffect(() => {
    if (!isMobile) {
      setIsExamSidebarOpen(false);
    }
  }, [isMobile]);

  // ── When exam is started, show the dedicated voice exam screen ──
  if (examStarted && examConfig) {
    return (
      <ExamVoiceSession
        session={session}
        id={id}
        examConfig={examConfig}
        initialMessages={resolvedInitialMessages}
      />
    );
  }

  // ── Default: chat UI with optional exam sidebar ──
  return (
    <div className="relative flex h-dvh min-h-0 flex-col md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <Chat
          key={id}
          id={id}
          initialMessages={resolvedInitialMessages}
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
        <>
          <div className="hidden h-dvh w-[22rem] shrink-0 border-l bg-sidebar md:flex md:flex-col lg:w-96">
            <ExamSidebar
              examConfig={examConfig}
              append={appendReady ? appendRef.current || undefined : undefined}
            />
          </div>

          <div className="md:hidden">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-40 gap-2 rounded-full shadow-lg"
              onClick={() => setIsExamSidebarOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              Exam Controls
            </Button>

            <Sheet open={isExamSidebarOpen} onOpenChange={setIsExamSidebarOpen}>
              <SheetContent
                side="bottom"
                className="flex h-[82dvh] flex-col rounded-t-2xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Exam Controls</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ExamSidebar
                    examConfig={examConfig}
                    append={
                      appendReady ? appendRef.current || undefined : undefined
                    }
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}
    </div>
  );
}
