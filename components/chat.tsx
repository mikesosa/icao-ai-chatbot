'use client';

import { Suspense, useEffect, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { type UseChatHelpers, useChat } from '@ai-sdk/react';
import type { Attachment, UIMessage } from 'ai';
import type { Session } from 'next-auth';
import useSWR, { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';

import { SubscriptionBanner } from '@/components/billing/subscription-banner';
import { ChatHeader } from '@/components/chat-header';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useExamContext } from '@/hooks/use-exam-context';
import { useSubscription } from '@/hooks/use-subscription';
import type { Vote } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import {
  fetchWithErrorHandlers,
  fetcher,
  generateUUID,
  getModelType,
} from '@/lib/utils';

import { Artifact } from './artifact';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { VisibilityType } from './visibility-selector';

// Componente interno que usa useSearchParams
function ChatWithSearchParams({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  hideControls,
  onAppendRef,
  onDataStreamUpdate,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
  hideControls?: boolean;
  onAppendRef?: (append: UseChatHelpers['append']) => void;
  onDataStreamUpdate?: (data: any[]) => void;
}) {
  const { mutate } = useSWRConfig();
  const {
    examType,
    examStarted,
    currentSection,
    currentSubsection,
    readyToStartExam,
    setOnSectionChange,
  } = useExamContext();
  const { subscription } = useSubscription();
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  // Use examType as the selected model when available, otherwise use initialChatModel
  const selectedChatModel = examType || initialChatModel;

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: fetchWithErrorHandlers,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel,
      selectedVisibilityType: visibilityType,
      modelType: getModelType(selectedChatModel),
      // Include current section and subsection for exam models
      ...(examType && {
        currentSection,
        currentSubsection,
      }),
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const lastMessagesCount = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const lastMessage = messages[messages.length - 1];
      console.debug('[chat] messages update', {
        count: messages.length,
        prevCount: lastMessagesCount.current,
        lastMessageId: lastMessage?.id,
        lastMessageRole: lastMessage?.role,
      });
      lastMessagesCount.current = messages.length;
    }
  }, [messages]);

  useEffect(() => {
    // Notify parent component of data stream updates
    if (onDataStreamUpdate && data) {
      onDataStreamUpdate(data);
    }
  }, [data, onDataStreamUpdate]);

  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const examParam = searchParams.get('exam');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const [hasInitializedExamFromQuery, setHasInitializedExamFromQuery] =
    useState(false);

  // Use ref instead of state for hasStartedExam to survive Fast Refresh
  const hasStartedExamRef = useRef(
    typeof window !== 'undefined' &&
      sessionStorage.getItem(`exam-started:${id}`) === '1',
  );

  // Reset exam-started flag when exam ends
  useEffect(() => {
    if (!examStarted && hasStartedExamRef.current) {
      hasStartedExamRef.current = false;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`exam-started:${id}`);
      }
      if (process.env.NODE_ENV === 'development') {
        console.debug('[chat] exam ended, reset hasStartedExamRef', {
          chatId: id,
        });
      }
    }
  }, [examStarted, id]);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      append({
        role: 'user',
        content: query,
      });
      setHasAppendedQuery(true);
    }
  }, [query, append, hasAppendedQuery, id]);

  useEffect(() => {
    if (!examParam || hasInitializedExamFromQuery) {
      return;
    }

    if (!subscription || !subscription.isActive) {
      return;
    }

    readyToStartExam(examParam);
    setHasInitializedExamFromQuery(true);
  }, [examParam, hasInitializedExamFromQuery, readyToStartExam, subscription]);

  // Auto-start exam when examStarted becomes true
  // Use ref to prevent duplicate appends during Fast Refresh / re-mounts
  useEffect(() => {
    // Skip if already started (ref or sessionStorage)
    if (hasStartedExamRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[chat] auto-start skipped (ref already true)', {
          chatId: id,
        });
      }
      return;
    }

    // Skip if not ready
    if (!examStarted || !examType) {
      return;
    }

    // Double-check sessionStorage
    const alreadyStartedInStorage =
      typeof window !== 'undefined' &&
      sessionStorage.getItem(`exam-started:${id}`) === '1';
    if (alreadyStartedInStorage) {
      hasStartedExamRef.current = true;
      if (process.env.NODE_ENV === 'development') {
        console.debug('[chat] auto-start skipped (sessionStorage)', {
          chatId: id,
        });
      }
      return;
    }

    // Check if message already exists in current messages
    const alreadyStartedMessage = messages.some(
      (message) =>
        message.role === 'user' &&
        message.content ===
          'Start the evaluation. Begin with the first section.',
    );
    if (alreadyStartedMessage) {
      hasStartedExamRef.current = true;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`exam-started:${id}`, '1');
      }
      if (process.env.NODE_ENV === 'development') {
        console.debug('[chat] auto-start skipped (message exists)', {
          chatId: id,
          messageCount: messages.length,
        });
      }
      return;
    }

    // All checks passed - append the start message
    hasStartedExamRef.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`exam-started:${id}`, '1');
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[chat] auto-start exam APPENDING', {
        chatId: id,
        messageCount: messages.length,
      });
    }

    append({
      role: 'user',
      content: 'Start the evaluation. Begin with the first section.',
    });
  }, [examStarted, examType, append, messages, id]);

  // Set up callback for admin section changes
  useEffect(() => {
    if (examType && examStarted) {
      setOnSectionChange((section: string, subsection?: string) => {
        if (subsection) {
          console.log(
            `[CHAT] Admin jumped to subsection ${subsection}, requesting content`,
          );
          append({
            role: 'user',
            content: `[Admin] I've jumped to Subsection ${subsection}. Please provide the specific instructions and content for this subsection.`,
          });
        } else {
          console.log(
            `[CHAT] Admin jumped to section ${section}, requesting section content`,
          );
          append({
            role: 'user',
            content: `[Admin] I've jumped to Section ${section}. Please provide the introduction and content for this section.`,
          });
        }
      });

      return () => {
        setOnSectionChange(null);
      };
    }
  }, [examType, examStarted, setOnSectionChange, append]);

  // Track if we've already notified parent of append function
  const hasNotifiedAppendRef = useRef(false);

  // Notify parent of append function (only once)
  useEffect(() => {
    if (onAppendRef && !hasNotifiedAppendRef.current) {
      hasNotifiedAppendRef.current = true;
      onAppendRef(append);
    }
  }, [append, onAppendRef]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
          hideControls={hideControls}
        />
        <SubscriptionBanner />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          hideControls={hideControls}
          selectedModel={selectedChatModel}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && examType && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              selectedVisibilityType={visibilityType}
              hideControls={hideControls}
              _audioOnly={false} // Let MultimodalInput decide based on section type (writing vs speaking)
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}

// Componente de carga con skeleton para Suspense
function ChatSkeleton() {
  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background">
      <div className="h-16 bg-muted animate-pulse" />
      <div className="flex-1 p-4 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-16 bg-muted animate-pulse rounded" />
        <div className="h-12 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

// Componente principal exportado
export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
  hideControls,
  onAppendRef,
  onDataStreamUpdate,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
  hideControls?: boolean;
  onAppendRef?: (append: UseChatHelpers['append']) => void;
  onDataStreamUpdate?: (data: any[]) => void;
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatWithSearchParams
        id={id}
        initialMessages={initialMessages}
        initialChatModel={initialChatModel}
        initialVisibilityType={initialVisibilityType}
        isReadonly={isReadonly}
        session={session}
        autoResume={autoResume}
        hideControls={hideControls}
        onAppendRef={onAppendRef}
        onDataStreamUpdate={onDataStreamUpdate}
      />
    </Suspense>
  );
}
