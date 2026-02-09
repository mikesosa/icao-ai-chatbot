'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTts } from '@/hooks/use-tts';
import { isOpenAIVoice } from '@/lib/voice/openai';

function normalizeForSpeech(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // strip code blocks
    .replace(/`([^`]+)`/g, '$1') // strip inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip markdown links
    .replace(/[*_>#]+/g, ' ') // strip formatting markers
    .replace(/(\d+)\.\s/g, '$1, ') // "2. " → "2, " to avoid "two dot" in TTS
    .replace(/\s+/g, ' ')
    .trim();
}

type QueueItem = {
  id: number;
  text: string;
  status: 'fetching' | 'ready' | 'playing' | 'done' | 'error';
  blob?: Blob;
  abortController?: AbortController;
};

/**
 * Streaming TTS hook — accepts sentences one at a time, fetches audio in
 * parallel, and plays them back sequentially. Designed for overlapping
 * chat-streaming + TTS generation.
 */
export function useStreamingTTS() {
  const { setActiveMessageId, selectedVoice, speechRate } = useTts();

  const queueRef = useRef<QueueItem[]>([]);
  const nextIdRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const playingIndexRef = useRef(-1);
  const stoppedRef = useRef(false);

  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [currentSentence, setCurrentSentence] = useState('');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [totalEnqueued, setTotalEnqueued] = useState(0);

  // Progress within the current audio chunk
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ── Play the next ready item in the queue ──
  const playNext = useCallback(() => {
    if (stoppedRef.current) return;

    const queue = queueRef.current;
    const nextIndex = playingIndexRef.current + 1;

    // Find the next item that's ready
    if (nextIndex >= queue.length) return;

    const item = queue[nextIndex];
    if (!item) return;

    if (item.status === 'fetching') {
      // Not ready yet — will be triggered when fetch completes
      return;
    }

    if (item.status !== 'ready' || !item.blob) {
      // Skip errored items
      playingIndexRef.current = nextIndex;
      playNext();
      return;
    }

    // Play this item
    item.status = 'playing';
    playingIndexRef.current = nextIndex;

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }

    const url = URL.createObjectURL(item.blob);
    audioUrlRef.current = url;

    const audio = new Audio(url);
    audio.playbackRate = speechRate;
    audioRef.current = audio;

    setCurrentSentence(item.text);
    setCurrentSentenceIndex(nextIndex);
    setAiSpeaking(true);
    setAudioCurrentTime(0);
    setAudioDuration(0);

    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    const checkAllDone = () => {
      const allDone = queueRef.current.every(
        (q) => q.status === 'done' || q.status === 'error',
      );
      if (allDone) {
        setAiSpeaking(false);
        setTtsLoading(false);
        setActiveMessageId(null);
      }
    };

    audio.onended = () => {
      clearProgressTimer();
      item.status = 'done';

      // Clean up
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      audioRef.current = null;

      // Try to play next, then check if we're all done
      playNext();
      checkAllDone();
    };

    audio.onerror = () => {
      clearProgressTimer();
      item.status = 'error';
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      audioRef.current = null;
      playNext();
      checkAllDone();
    };

    audio.play().catch(() => {
      item.status = 'error';
      playNext();
      checkAllDone();
    });

    // Start progress polling
    clearProgressTimer();
    progressTimerRef.current = window.setInterval(() => {
      if (!audioRef.current) return;
      setAudioCurrentTime(audioRef.current.currentTime || 0);
    }, 50);
  }, [speechRate, clearProgressTimer, setActiveMessageId]);

  // ── Enqueue a sentence for TTS ──
  const enqueue = useCallback(
    (text: string, opts?: { messageId?: string | null }) => {
      const cleaned = normalizeForSpeech(text);
      if (!cleaned) return;

      if (stoppedRef.current) {
        stoppedRef.current = false;
        queueRef.current = [];
        playingIndexRef.current = -1;
        nextIdRef.current = 0;
      }

      const id = nextIdRef.current++;
      const abortController = new AbortController();

      const item: QueueItem = {
        id,
        text: cleaned,
        status: 'fetching',
        abortController,
      };

      queueRef.current.push(item);
      setTotalEnqueued(queueRef.current.length);
      setTtsLoading(true);

      if (opts?.messageId) {
        setActiveMessageId(opts.messageId);
      }

      const voice =
        selectedVoice && isOpenAIVoice(selectedVoice)
          ? selectedVoice
          : undefined;

      // Fire TTS fetch immediately (don't await — runs in parallel)
      fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleaned, voice }),
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('TTS fetch failed');
          return response.blob();
        })
        .then((blob) => {
          item.blob = blob;
          item.status = 'ready';

          // If nothing is playing and this is the next item, start playing
          if (
            playingIndexRef.current < queueRef.current.indexOf(item) &&
            !audioRef.current
          ) {
            // Check if everything before this is done
            const idx = queueRef.current.indexOf(item);
            const allPriorDone = queueRef.current
              .slice(0, idx)
              .every((q) => q.status === 'done' || q.status === 'error');
            if (allPriorDone) {
              playingIndexRef.current = idx - 1;
              playNext();
            }
          }
        })
        .catch(() => {
          if (abortController.signal.aborted) return;
          item.status = 'error';
          // Try next if we were waiting on this one
          const idx = queueRef.current.indexOf(item);
          if (idx === playingIndexRef.current + 1) {
            playNext();
          }
          // Always check if all items are now done/errored
          const allDone = queueRef.current.every(
            (q) => q.status === 'done' || q.status === 'error',
          );
          if (allDone && !audioRef.current) {
            setAiSpeaking(false);
            setTtsLoading(false);
            setActiveMessageId(null);
          }
        });
    },
    [selectedVoice, setActiveMessageId, playNext],
  );

  // ── Stop everything ──
  const stop = useCallback(() => {
    stoppedRef.current = true;

    // Abort all in-flight fetches
    for (const item of queueRef.current) {
      item.abortController?.abort();
    }

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

    queueRef.current = [];
    playingIndexRef.current = -1;
    nextIdRef.current = 0;

    setAiSpeaking(false);
    setTtsLoading(false);
    setCurrentSentence('');
    setCurrentSentenceIndex(-1);
    setTotalEnqueued(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setActiveMessageId(null);
  }, [clearProgressTimer, setActiveMessageId]);

  // ── Reset for a new message ──
  const reset = useCallback(() => {
    stop();
    stoppedRef.current = false;
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const audioProgress =
    audioDuration > 0 ? Math.min(audioCurrentTime / audioDuration, 1) : 0;

  return useMemo(
    () => ({
      enqueue,
      stop,
      reset,
      aiSpeaking,
      ttsLoading,
      currentSentence,
      currentSentenceIndex,
      totalEnqueued,
      audioProgress,
    }),
    [
      enqueue,
      stop,
      reset,
      aiSpeaking,
      ttsLoading,
      currentSentence,
      currentSentenceIndex,
      totalEnqueued,
      audioProgress,
    ],
  );
}
