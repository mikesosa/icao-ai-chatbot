'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTts } from '@/hooks/use-tts';
import { isOpenAIVoice } from '@/lib/voice/openai';

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
  const { setActiveMessageId, selectedVoice, speechRate } = useTts();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [isSupported] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    clearProgressTimer();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setAiSpeaking(false);
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setActiveMessageId(null);
  }, [setActiveMessageId, clearProgressTimer]);

  const speak = useCallback(
    async (text: string, opts?: { messageId?: string | null }) => {
      if (!text) return false;

      const cleaned = normalizeForSpeech(text);
      if (!cleaned) return false;

      stop();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const messageId = opts?.messageId ?? null;
      setActiveMessageId(messageId);
      setAiSpeaking(true);
      setAudioCurrentTime(0);
      setAudioDuration(0);

      try {
        const voice =
          selectedVoice && isOpenAIVoice(selectedVoice)
            ? selectedVoice
            : undefined;

        const response = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleaned, voice }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let apiError = 'OpenAI voice request failed';
          try {
            const body = (await response.json()) as { error?: string };
            if (body.error) apiError = body.error;
          } catch {
            /* keep default */
          }
          throw new Error(apiError);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audio.playbackRate = speechRate;
        audioRef.current = audio;

        audio.onloadedmetadata = () => {
          setAudioDuration(audio.duration || 0);
        };

        const cleanup = () => {
          clearProgressTimer();
          setAiSpeaking(false);
          setAudioDuration((d) => d); // keep final duration for last frame
          setAudioCurrentTime((d) => d);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
          audioRef.current = null;
          setActiveMessageId(null);
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        await audio.play();

        // Poll currentTime at ~20 fps
        progressTimerRef.current = window.setInterval(() => {
          if (!audioRef.current) return;
          setAudioCurrentTime(audioRef.current.currentTime || 0);
        }, 50);

        return true;
      } catch (err) {
        setAiSpeaking(false);
        setAudioDuration(0);
        setAudioCurrentTime(0);
        if (controller.signal.aborted) return false;
        console.error('Failed to synthesize OpenAI speech:', err);
        setActiveMessageId(null);
        return false;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [selectedVoice, speechRate, setActiveMessageId, stop, clearProgressTimer],
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Derived progress 0-1
  const audioProgress =
    audioDuration > 0 ? Math.min(audioCurrentTime / audioDuration, 1) : 0;

  return useMemo(
    () => ({
      isSupported,
      speak,
      stop,
      aiSpeaking,
      audioDuration,
      audioCurrentTime,
      audioProgress,
    }),
    [
      isSupported,
      speak,
      stop,
      aiSpeaking,
      audioDuration,
      audioCurrentTime,
      audioProgress,
    ],
  );
}
