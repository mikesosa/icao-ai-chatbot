'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import useSWR from 'swr';

export type TtsState = {
  enabled: boolean;
  activeMessageId: string | null;
};

const initialTtsState: TtsState = {
  enabled: false,
  activeMessageId: null,
};

type Selector<T> = (state: TtsState) => T;

const STORAGE_KEY = 'tts:enabled';
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

  // Initialize `enabled` from localStorage once per session.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Best-effort global guard to avoid repeated init across multiple hook users.
    const w = window as unknown as Record<string, unknown>;
    if (w[INIT_GUARD] === true) return;
    w[INIT_GUARD] = true;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    const enabled = stored === '1';

    mutate((current) => ({ ...(current || initialTtsState), enabled }), {
      revalidate: false,
    });
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
        window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
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

  return useMemo(
    () => ({
      ...state,
      setEnabled,
      setActiveMessageId,
    }),
    [state, setEnabled, setActiveMessageId],
  );
}
