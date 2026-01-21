'use client';

import { useEffect } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

import type { DataPart } from '@/lib/types';

export interface UseAutoResumeParams {
  autoResume: boolean;
  initialMessages: UIMessage[];
  experimental_resume: UseChatHelpers['experimental_resume'];
  data: UseChatHelpers['data'];
  setMessages: UseChatHelpers['setMessages'];
}

export function useAutoResume({
  autoResume,
  initialMessages,
  experimental_resume,
  data,
  setMessages,
}: UseAutoResumeParams) {
  useEffect(() => {
    if (!autoResume) return;

    const mostRecentMessage = initialMessages.at(-1);

    if (mostRecentMessage?.role === 'user') {
      experimental_resume();
    }

    // we intentionally run this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data) return;
    if (data.length === 0) return;

    const dataPart = data[0] as DataPart;

    if (dataPart.type === 'append-message') {
      const message = JSON.parse(dataPart.message) as UIMessage;
      if (process.env.NODE_ENV === 'development') {
        console.debug('[auto-resume] append-message', {
          messageId: message.id,
          initialMessages: initialMessages.length,
        });
      }
      setMessages((prev) => {
        const alreadyExists = prev.some(
          (existing) => existing.id === message.id,
        );
        if (process.env.NODE_ENV === 'development') {
          console.debug('[auto-resume] setMessages', {
            prevCount: prev.length,
            alreadyExists,
          });
        }
        if (alreadyExists) return prev;
        return [...prev, message];
      });
    }
  }, [data, initialMessages, setMessages]);
}
