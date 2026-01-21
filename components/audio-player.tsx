'use client';

import { useEffect, useRef, useState } from 'react';

import { CheckCircle, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';

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
  subsection,
  audioFile,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

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
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setHasPlayedOnce(true);
      setActiveAudioPlayerId?.(null);
      // Mark as completed if this is an exam recording
      if (isExamRecording && !isCompleted && onComplete) {
        onComplete();
      }
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleError = () => {
      setError('Error loading audio file');
      setIsLoading(false);
      setActiveAudioPlayerId?.(null);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
    };
  }, [isExamRecording, isCompleted, onComplete, setActiveAudioPlayerId]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setActiveAudioPlayerId?.(null);
    } else {
      // Stop any other playing audio first (only if exam context is available)
      if (examContext && setActiveAudioPlayerId) {
        setActiveAudioPlayerId(recordingId || '');
      }

      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const seekTime = Number.parseFloat(e.target.value);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Only reset the audio to the beginning and play it again
    audio.currentTime = 0;
    setCurrentTime(0);
    setHasPlayedOnce(false);
    // Do not change section/subsection or trigger any advancement
    if (!isPlaying) {
      audio.play();
      setIsPlaying(true);
      if (examContext && setActiveAudioPlayerId) {
        setActiveAudioPlayerId(recordingId || '');
      }
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

  if (error) {
    return (
      <div className={cn('bg-muted rounded-lg p-4', className)}>
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-card border rounded-lg p-4 space-y-3',
        {
          'ring-2 ring-primary/20': isExamRecording && isPlaying,
          'ring-2 ring-green-500/20': isExamRecording && isCompleted,
        },
        className,
      )}
      data-recording-id={recordingId}
      data-audio-file={audioFile}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Header with Recording Info */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {title && (
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              {title}
              {isExamRecording && isCompleted && (
                <CheckCircle className="size-4 text-green-500" />
              )}
            </h4>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {subsection && (
            <p className="text-xs text-muted-foreground">
              Section: {subsection}
            </p>
          )}
          {recordingId && (
            <p className="text-xs text-muted-foreground">ID: {recordingId}</p>
          )}
        </div>

        {/* Status indicator for exam recordings */}
        {isExamRecording && (
          <div className="flex items-center gap-1">
            {isCompleted ? (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                Completed
              </span>
            ) : hasPlayedOnce ? (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                Played
              </span>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                Not played
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Controls */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
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
          disabled={isLoading || !!error}
          className="rounded-full size-8 p-0"
        >
          <RotateCcw className="size-3" />
        </Button>

        {/* Progress Bar */}
        <div className="flex-1 space-y-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading || !!error}
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

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="size-3 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            disabled={isLoading || !!error}
            className="w-16 h-1 bg-muted rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-2
                     [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:size-2 [&::-moz-range-thumb]:bg-primary
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
          />
        </div>
      </div>

      {/* Instructions for exam recordings */}
      {isExamRecording && (
        <div className="text-xs text-muted-foreground">
          Press Play to listen.
          <br />💡 You may request repetition once if you didn&apos;t understand
          something the first time
        </div>
      )}
    </div>
  );
}
