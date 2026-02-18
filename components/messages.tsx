import { memo, useEffect, useMemo, useRef } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import equal from 'fast-deep-equal';
import { motion } from 'framer-motion';

import { useExamContext } from '@/hooks/use-exam-context';
import { useMessages } from '@/hooks/use-messages';
import { useTextToSpeech } from '@/hooks/use-text-to-speech';
import { useTtsSelector } from '@/hooks/use-tts';
import type { Vote } from '@/lib/db/schema';

import { Greeting } from './greeting';
import { PreviewMessage, ThinkingMessage } from './message';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers['status'];
  votes: Array<Vote> | undefined;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  hideControls?: boolean;
  selectedModel?: string;
}

function getMessageText(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  return '';
}

function isInternalExamSystemMessage(message: UIMessage): boolean {
  if (message.role !== 'user') return false;
  const text = getMessageText(message);
  return text.startsWith('[System]');
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
  hideControls,
  selectedModel,
}: MessagesProps) {
  const { examStarted, examType } = useExamContext();
  const ttsEnabled = useTtsSelector((s) => s.enabled);
  const { isSupported, speak, stop } = useTextToSpeech();
  // Tracks the last assistant message we've already spoken (or skipped).
  const lastAutoSpokenIdRef = useRef<string | null>(
    messages.findLast((m) => m.role === 'assistant')?.id ?? null,
  );
  // Track whether the ref has been seeded with the initial batch of messages.
  const hasSeededRef = useRef(lastAutoSpokenIdRef.current !== null);
  const prevMessageCountRef = useRef(messages.length);
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });
  const visibleMessages = useMemo(() => {
    if (!examStarted && !examType) return messages;
    return messages.filter((message) => !isInternalExamSystemMessage(message));
  }, [messages, examStarted, examType]);

  // Seed the ref when messages first arrive from DB (handles async loading).
  // This MUST be declared BEFORE the auto-TTS effect so it runs first.
  useEffect(() => {
    prevMessageCountRef.current = messages.length;

    // Initial batch load: messages jumped from 0 to N
    if (!hasSeededRef.current && messages.length > 0) {
      hasSeededRef.current = true;
      const lastAssistant = messages.findLast((m) => m.role === 'assistant');
      if (lastAssistant) {
        lastAutoSpokenIdRef.current = lastAssistant.id;
      }
    }
  }, [messages]);

  useEffect(() => {
    // Disable auto-TTS in messages.tsx when an exam model is selected.
    // ExamVoiceSession handles all TTS once the exam starts.
    if (examStarted || examType) return;

    if (!ttsEnabled || !isSupported) return;

    // Only auto-read when the assistant message is done streaming.
    if (status === 'streaming' || status === 'submitted') return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (last.id === lastAutoSpokenIdRef.current) return;

    const text = last.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim();

    if (!text) return;

    // Stop any in-progress speech and read the latest assistant reply.
    stop();
    speak(text, { messageId: last.id }).then((didSpeak) => {
      if (didSpeak) lastAutoSpokenIdRef.current = last.id;
    });
  }, [
    examStarted,
    examType,
    ttsEnabled,
    isSupported,
    messages,
    status,
    speak,
    stop,
  ]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative"
    >
      {visibleMessages.length === 0 && !examStarted && (
        <Greeting selectedModel={selectedModel} />
      )}

      {visibleMessages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={
            status === 'streaming' && visibleMessages.length - 1 === index
          }
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          hideControls={hideControls}
          requiresScrollPadding={
            hasSentMessage && index === visibleMessages.length - 1
          }
        />
      ))}

      {status === 'submitted' &&
        visibleMessages.length > 0 &&
        visibleMessages[visibleMessages.length - 1].role === 'user' && (
          <ThinkingMessage />
        )}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.chatId !== nextProps.chatId) return false;
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.isReadonly !== nextProps.isReadonly) return false;
  if (prevProps.isArtifactVisible !== nextProps.isArtifactVisible) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;

  return true;
});
