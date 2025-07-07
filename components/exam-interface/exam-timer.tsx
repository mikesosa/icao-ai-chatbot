'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type {
  ExamSection,
  ExamSectionConfig,
  ExamConfig,
} from '@/lib/exam-configs';

interface ExamTimerProps {
  currentSection: ExamSection;
  examConfig: ExamConfig;
  onSectionComplete?: (section: ExamSection) => void;
  onTimerWarning?: (section: ExamSection, timeLeft: number) => void;
  isRunning?: boolean;
  onToggleTimer?: () => void;
  onResetTimer?: (section: ExamSection) => void;
}

export function ExamTimer({
  currentSection,
  examConfig,
  onSectionComplete,
  onTimerWarning,
  isRunning = false,
  onToggleTimer,
  onResetTimer,
}: ExamTimerProps) {
  const sectionConfig = examConfig.sections[currentSection];
  const [timeLeft, setTimeLeft] = useState(sectionConfig.duration);

  // Reset timer when section changes
  useEffect(() => {
    setTimeLeft(sectionConfig.duration);
  }, [currentSection, sectionConfig.duration]);

  // Timer logic
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onSectionComplete?.(currentSection);
          return 0;
        }

        // Warning at 2 minutes (120 seconds)
        if (prev === 120) {
          onTimerWarning?.(currentSection, prev);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, currentSection, onSectionComplete, onTimerWarning]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  // Get progress percentage
  const getProgressPercentage = (): number => {
    return ((sectionConfig.duration - timeLeft) / sectionConfig.duration) * 100;
  };

  // Get time color based on remaining time
  const getTimeColor = (): string => {
    if (timeLeft <= 60) return 'text-red-500'; // Last minute
    if (timeLeft <= 120) return 'text-orange-500'; // Last 2 minutes
    return 'text-gray-800';
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5" />
            <span className="font-semibold">Sección {currentSection}</span>
          </div>
          <span className="text-sm text-gray-400">{sectionConfig.name}</span>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div className={`text-4xl font-mono ${getTimeColor()}`}>
            {formatTime(timeLeft)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {formatTime(sectionConfig.duration)} total
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${sectionConfig.color}`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleTimer}
            className="flex items-center gap-1"
          >
            {isRunning ? (
              <>
                <Pause className="size-4" />
                Pausar
              </>
            ) : (
              <>
                <Play className="size-4" />
                Iniciar
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onResetTimer?.(currentSection)}
            className="flex items-center gap-1"
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Estado:</span>
            <span className={isRunning ? 'text-green-600' : 'text-gray-400'}>
              {isRunning ? 'Corriendo' : 'Pausado'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Progreso:</span>
            <span>{Math.round(getProgressPercentage())}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export types for backward compatibility
export type {
  ExamSection,
  ExamSectionConfig,
  ExamConfig,
} from '@/lib/exam-configs';
