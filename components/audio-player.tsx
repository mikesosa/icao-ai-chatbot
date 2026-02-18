'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  playbackLocked?: boolean; // Prevent playback while examiner audio is active
}

export function AudioPlayer({
  src,
  title,
  description,
  className,
  recordingId,
  isExamRecording = false,
  isCompleted = false,
  onComplete,
  subsection: _subsection,
  audioFile,
  autoPlay = false,
  onPlaybackStateChange,
  onPlaybackEnded,
  maxReplays = 99,
  allowSeek = true,
  playbackLocked = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayCount, setReplayCount] = useState(0);
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
  }, [examContext, setActiveAudioPlayerId, recordingId, playbackLocked]);

  const togglePlayPause = () => {
    if (playbackLocked) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = Number.parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
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

  if (error) {
    return (
      <div className={cn('bg-muted rounded-lg p-4', className)}>
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={cn('bg-card/70 border rounded-lg p-3 space-y-3', className)}
      data-recording-id={recordingId}
      data-audio-file={audioFile}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          {title && (
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        {isLoading && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={togglePlayPause}
          disabled={isLoading || !!error || playbackLocked}
          className="rounded-full size-8 p-0"
        >
          {isLoading ? (
            <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="size-3" />
          ) : (
            <Play className="size-3 ml-0.5" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleRestart}
          disabled={restartDisabled}
          className="rounded-full size-8 p-0"
        >
          <RotateCcw className="size-3" />
        </Button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading || !!error || !allowSeek || playbackLocked}
            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3
                     [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:bg-primary
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="size-3 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            disabled={isLoading || !!error || playbackLocked}
            className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-2
                     [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:size-2 [&::-moz-range-thumb]:bg-primary
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
          />
        </div>
      </div>

      {isCompleted && (
        <div className="text-[11px] text-muted-foreground">
          Playback complete
        </div>
      )}

      {isExamRecording && (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">
            Replays: {Math.min(replayCount, maxReplays)} / {maxReplays}
          </div>
          {audioFile && (
            <div className="text-[11px] text-muted-foreground">
              Source file: {audioFile}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
