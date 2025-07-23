'use client';

import { useEffect, useState } from 'react';

import { Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import type { ExamConfig, ExamSection } from './exam';

interface ExamTimerProps {
  currentSection: ExamSection;
  examConfig: ExamConfig;
  onSectionComplete?: (section: ExamSection) => void;
  onTimerWarning?: (section: ExamSection, timeLeft: number) => void;
}

export function ExamTimer({
  currentSection,
  examConfig,
  onSectionComplete,
  onTimerWarning,
}: ExamTimerProps) {
  const sectionConfig = examConfig.sections[currentSection];
  const [timeLeft, setTimeLeft] = useState(sectionConfig.duration);
  const [isRunning, setIsRunning] = useState(true); // Always running once timer is mounted

  // Reset timer when section changes
  useEffect(() => {
    setTimeLeft(sectionConfig.duration);
    setIsRunning(true); // Auto-start when section changes
  }, [currentSection, sectionConfig.duration]);

  // Timer logic - runs continuously
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
  const _getTimeColor = (): string => {
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
            <Clock className="size-4" />
            <span className="font-semibold">Section {currentSection}</span>
          </div>
          <Badge variant="outline">{formatTime(sectionDuration)}</Badge>
        </div>

        {/* Timer Display */}
        <div className="text-2xl font-mono font-bold text-center mb-2">
          {formatTime(timeLeft)}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${sectionConfig.color}`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>

        {/* Status Indicators */}
        <div className="mt-4 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="text-green-600">Running</span>
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
