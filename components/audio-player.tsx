'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Pause, Play, RotateCcw } from 'lucide-react';

import { useExamContext } from '@/hooks/use-exam-context';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  title?: string;
  description?: string;
  className?: string;
  recordingId?: string; // Unique identifier for the recording
  isExamRecording?: boolean; // Flag to indicate if this is an exam recording
  isCompleted?: boolean; // Flag to indicate if this recording has been completed
  onComplete?: () => void; // Callback when recording is completed
  subsection?: string; // Exam subsection identifier
  audioFile?: string; // Audio file name for reference
  autoPlay?: boolean; // Auto-start playback when ready
  onPlaybackStateChange?: (isPlaying: boolean) => void; // Notify parent about playback state
  onPlaybackEnded?: () => void; // Notify parent when playback ends
  maxReplays?: number; // Maximum number of replay attempts allowed
  allowSeek?: boolean; // Whether timeline seeking is allowed
  allowPause?: boolean; // Whether pause control is allowed
  playbackLocked?: boolean; // Prevent playback while examiner audio is active
}

export function AudioPlayer({
  src,
  title,
  className,
  recordingId,
  isExamRecording = false,
  isCompleted = false,
  onComplete,
  subsection: _subsection,
  autoPlay = false,
  onPlaybackStateChange,
  onPlaybackEnded,
  maxReplays = 99,
  allowSeek = true,
  allowPause = true,
  playbackLocked = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
  const [hasEndedPlayback, setHasEndedPlayback] = useState(false);
  const hasAutoPlayedRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Get exam context for global audio state management (optional)
  const examContext = useExamContext();
  const { activeAudioPlayerId, setActiveAudioPlayerId } = examContext || {};

  // Check if this player is the active one (only if exam context is available)
  const isActivePlayer = examContext
    ? activeAudioPlayerId === recordingId
    : true;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      if (audio.readyState >= 1) {
        setIsLoading(false);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setHasEndedPlayback(true);
      setActiveAudioPlayerId?.(null);
      onPlaybackEnded?.();
      // Mark as completed if this is an exam recording
      if (isExamRecording && !isCompleted && onComplete) {
        onComplete();
      }
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadedData = () => setIsLoading(false);
    const handleCanPlayThrough = () => setIsLoading(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleError = () => {
      setError('Error loading audio file');
      setIsLoading(false);
      setIsPlaying(false);
      setActiveAudioPlayerId?.(null);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
    };
  }, [
    isExamRecording,
    isCompleted,
    onComplete,
    setActiveAudioPlayerId,
    onPlaybackEnded,
  ]);

  const startPlayback = useCallback(async () => {
    if (playbackLocked) return;
    if (hasEndedPlayback && maxReplays === 0) return;

    const audio = audioRef.current;
    if (!audio) return;

    // Stop any other playing audio first (only if exam context is available)
    if (examContext && setActiveAudioPlayerId) {
      setActiveAudioPlayerId(recordingId || '');
    }

    try {
      await audio.play();
      setError(null);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setActiveAudioPlayerId?.(null);
      setError('Playback failed. Please press Play to try again.');
    }
  }, [
    examContext,
    setActiveAudioPlayerId,
    recordingId,
    playbackLocked,
    hasEndedPlayback,
    maxReplays,
  ]);

  const togglePlayPause = () => {
    if (playbackLocked) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      if (!allowPause) return;
      audio.pause();
      setIsPlaying(false);
      setActiveAudioPlayerId?.(null);
    } else {
      startPlayback();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowSeek) return;

    const audio = audioRef.current;
    if (!audio) return;

    const seekTime = Number.parseFloat(e.target.value);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleRestart = () => {
    if (playbackLocked) return;
    if (replayCount >= maxReplays) return;

    const audio = audioRef.current;
    if (!audio) return;

    const shouldCountReplay = audio.currentTime > 0 || isPlaying || isCompleted;
    if (shouldCountReplay) {
      setReplayCount((previous) => previous + 1);
    }

    // Only reset the audio to the beginning and play it again
    audio.currentTime = 0;
    setCurrentTime(0);
    // Do not change section/subsection or trigger any advancement
    if (!isPlaying) {
      startPlayback();
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update local playing state when global state changes (only if exam context is available)
  useEffect(() => {
    if (examContext && !isActivePlayer && isPlaying) {
      setIsPlaying(false);
    }
  }, [examContext, isActivePlayer, isPlaying]);

  useEffect(() => {
    if (!playbackLocked || !isPlaying) return;

    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
    setActiveAudioPlayerId?.(null);
  }, [playbackLocked, isPlaying, setActiveAudioPlayerId]);

  useEffect(() => {
    onPlaybackStateChange?.(isPlaying);
  }, [isPlaying, onPlaybackStateChange]);

  useEffect(() => {
    hasAutoPlayedRef.current = false;
    setReplayCount(0);
    setHasEndedPlayback(false);
  }, [src, recordingId]);

  useEffect(() => {
    if (
      !autoPlay ||
      hasAutoPlayedRef.current ||
      isPlaying ||
      isLoading ||
      !!error ||
      playbackLocked
    ) {
      return;
    }

    hasAutoPlayedRef.current = true;
    startPlayback();
  }, [autoPlay, isPlaying, isLoading, error, playbackLocked, startPlayback]);

  const restartDisabled =
    isLoading ||
    !!error ||
    playbackLocked ||
    (isExamRecording && replayCount >= maxReplays);
  const playPauseDisabled =
    isLoading ||
    !!error ||
    playbackLocked ||
    (isPlaying && !allowPause) ||
    (!isPlaying && hasEndedPlayback && maxReplays === 0);

  if (error) {
    return (
      <div className={cn('bg-muted rounded-lg p-4', className)}>
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }

  const replayLimit = maxReplays < 99;
  const replaysRemaining = replayLimit ? maxReplays - replayCount : null;

  return (
    <div
      className={cn('flex flex-col gap-3 w-full', className)}
      data-recording-id={recordingId}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <p className="text-xs text-muted-foreground text-center">{title}</p>
      )}

      {/* Scrubber */}
      <div className="flex flex-col gap-1 px-1">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          disabled={isLoading || !!error || !allowSeek || playbackLocked}
          className="w-full h-0.5 bg-muted/50 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3
                   [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                   [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:bg-foreground
                   [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground/60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={handleRestart}
          disabled={restartDisabled}
          className="text-muted-foreground disabled:opacity-20 transition-opacity p-2"
        >
          <RotateCcw className="size-4" />
        </button>

        <button
          type="button"
          onClick={togglePlayPause}
          disabled={playPauseDisabled}
          className="flex items-center justify-center size-12 rounded-full bg-foreground text-background disabled:opacity-30 transition-opacity active:scale-95"
        >
          {isLoading ? (
            <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 ml-0.5" />
          )}
        </button>

        {/* Spacer to balance the restart button */}
        <div className="size-8" />
      </div>

      {replayLimit && replaysRemaining !== null && (
        <p className="text-[11px] text-muted-foreground/60 text-center">
          {replaysRemaining > 0
            ? `${replaysRemaining} replay${replaysRemaining === 1 ? '' : 's'} remaining`
            : 'No replays remaining'}
        </p>
      )}
    </div>
  );
}
