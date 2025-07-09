'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ExamSection, ExamConfig } from './exam';
import { Badge } from '@/components/ui/badge';

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

  const sectionDuration = sectionConfig.duration;

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-4">
        {/* Section Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-blue-600" />
            <span className="font-semibold">Section {currentSection}</span>
          </div>
          <Badge variant="outline">{formatTime(sectionDuration)}</Badge>
        </div>

        {/* Timer Display */}
        <div className="text-center space-y-2">
          <div className="text-2xl font-mono font-bold">
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-gray-500 mb-3">
            {isRunning ? 'Running' : 'Paused'}
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
        <div className="flex gap-2">
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={onToggleTimer}
            className="flex-1"
          >
            {isRunning ? (
              <>
                <Pause className="size-4 mr-1" />
                Pause
              </>
            ) : (
              <>
                <Play className="size-4 mr-1" />
                Start
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResetTimer?.(currentSection)}
            className="flex-1"
          >
            <RotateCcw className="size-4 mr-1" />
            Reset
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={isRunning ? 'text-green-600' : 'text-gray-400'}>
              {isRunning ? 'Running' : 'Paused'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Progress:</span>
            <span>{Math.round(getProgressPercentage())}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
