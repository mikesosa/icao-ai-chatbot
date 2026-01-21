'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTts } from '@/hooks/use-tts';

function normalizeForSpeech(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useTextToSpeech() {
  const { setActiveMessageId } = useTts();

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported =
      'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    setIsSupported(supported);

    return () => {
      if (!supported) return;
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setActiveMessageId(null);
  }, [setActiveMessageId]);

  const speak = useCallback(
    (text: string, opts?: { messageId?: string | null }) => {
      if (typeof window === 'undefined') return false;
      if (!isSupported) return false;

      const cleaned = normalizeForSpeech(text);
      if (!cleaned) return false;

      // Ensure only one message is spoken at a time.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleaned);
      utteranceRef.current = utterance;

      const messageId = opts?.messageId ?? null;
      setActiveMessageId(messageId);

      utterance.onend = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
        }
        setActiveMessageId(null);
      };

      utterance.onerror = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
        }
        setActiveMessageId(null);
      };

      window.speechSynthesis.speak(utterance);
      return true;
    },
    [isSupported, setActiveMessageId],
  );

  return useMemo(
    () => ({
      isSupported,
      speak,
      stop,
    }),
    [isSupported, speak, stop],
  );
}
