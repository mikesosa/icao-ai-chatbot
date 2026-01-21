import { memo, useEffect, useRef } from 'react';

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
  const { examStarted } = useExamContext();
  const ttsEnabled = useTtsSelector((s) => s.enabled);
  const { isSupported, speak, stop } = useTextToSpeech();
  const lastAutoSpokenIdRef = useRef<string | null>(null);
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

  useEffect(() => {
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
    const didSpeak = speak(text, { messageId: last.id });
    if (didSpeak) lastAutoSpokenIdRef.current = last.id;
  }, [ttsEnabled, isSupported, messages, status, speak, stop]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative"
    >
      {messages.length === 0 && !examStarted && (
        <Greeting selectedModel={selectedModel} />
      )}

      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
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
            hasSentMessage && index === messages.length - 1
          }
        />
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

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
