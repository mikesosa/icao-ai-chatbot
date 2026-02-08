'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import useSWR from 'swr';

export type TtsState = {
  enabled: boolean;
  activeMessageId: string | null;
  selectedVoice: string | null;
  speechRate: number;
};

const initialTtsState: TtsState = {
  enabled: true,
  activeMessageId: null,
  selectedVoice: null,
  speechRate: 1.0,
};

type Selector<T> = (state: TtsState) => T;

const STORAGE_KEY_ENABLED = 'tts:enabled';
const STORAGE_KEY_VOICE = 'tts:voice';
const STORAGE_KEY_RATE = 'tts:rate';
const INIT_GUARD = '__tts_init__';

export function useTtsSelector<Selected>(selector: Selector<Selected>) {
  const { data } = useSWR<TtsState>('tts', null, {
    fallbackData: initialTtsState,
  });

  return useMemo(() => selector(data || initialTtsState), [data, selector]);
}

export function useTts() {
  const { data, mutate } = useSWR<TtsState>('tts', null, {
    fallbackData: initialTtsState,
  });

  const state = useMemo(() => data || initialTtsState, [data]);

  const didInitRef = useRef(false);

  // Initialize state from localStorage once per session.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Best-effort global guard to avoid repeated init across multiple hook users.
    const w = window as unknown as Record<string, unknown>;
    if (w[INIT_GUARD] === true) return;
    w[INIT_GUARD] = true;

    const storedEnabled = window.localStorage.getItem(STORAGE_KEY_ENABLED);
    const enabled = storedEnabled !== '0'; // Default to true unless explicitly disabled

    const storedVoice = window.localStorage.getItem(STORAGE_KEY_VOICE);
    const selectedVoice = storedVoice || null;

    const storedRate = window.localStorage.getItem(STORAGE_KEY_RATE);
    const speechRate = storedRate ? Number.parseFloat(storedRate) : 1.0;

    mutate(
      (current) => ({
        ...(current || initialTtsState),
        enabled,
        selectedVoice,
        speechRate,
      }),
      {
        revalidate: false,
      },
    );
  }, [mutate]);

  // Extra safety: ensure we only attempt init logic once per component instance.
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      mutate((current) => ({ ...(current || initialTtsState), enabled }), {
        revalidate: false,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? '1' : '0');
      }
    },
    [mutate],
  );

  const setActiveMessageId = useCallback(
    (activeMessageId: string | null) => {
      mutate(
        (current) => ({ ...(current || initialTtsState), activeMessageId }),
        { revalidate: false },
      );
    },
    [mutate],
  );

  const setSelectedVoice = useCallback(
    (selectedVoice: string | null) => {
      mutate(
        (current) => ({ ...(current || initialTtsState), selectedVoice }),
        {
          revalidate: false,
        },
      );

      if (typeof window !== 'undefined') {
        if (selectedVoice) {
          window.localStorage.setItem(STORAGE_KEY_VOICE, selectedVoice);
        } else {
          window.localStorage.removeItem(STORAGE_KEY_VOICE);
        }
      }
    },
    [mutate],
  );

  const setSpeechRate = useCallback(
    (speechRate: number) => {
      mutate((current) => ({ ...(current || initialTtsState), speechRate }), {
        revalidate: false,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY_RATE, speechRate.toString());
      }
    },
    [mutate],
  );

  return useMemo(
    () => ({
      ...state,
      setEnabled,
      setActiveMessageId,
      setSelectedVoice,
      setSpeechRate,
    }),
    [state, setEnabled, setActiveMessageId, setSelectedVoice, setSpeechRate],
  );
}
