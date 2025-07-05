'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type ExamSection = 1 | 2 | 3;

export interface ExamSectionConfig {
  name: string;
  duration: number; // en segundos
  color: string;
}

export interface ExamConfig {
  name: string;
  sections: Record<ExamSection, ExamSectionConfig>;
}

// Default TEA configuration for backward compatibility
export const TEA_EXAM_CONFIG: ExamConfig = {
  name: 'TEA',
  sections: {
    1: { name: 'Entrevista', duration: 2 * 60, color: 'bg-blue-500' },
    2: { name: 'Comprensión', duration: 2 * 60, color: 'bg-green-500' },
    3: { name: 'Discusión', duration: 2 * 60, color: 'bg-purple-500' },
  },
};

interface ExamTimerProps {
  currentSection: ExamSection;
  examConfig?: ExamConfig;
  onSectionComplete?: (section: ExamSection) => void;
  onTimerWarning?: (section: ExamSection, timeLeft: number) => void;
  isRunning?: boolean;
  onToggleTimer?: () => void;
  onResetTimer?: (section: ExamSection) => void;
}

export function ExamTimer({
  currentSection,
  examConfig = TEA_EXAM_CONFIG,
  onSectionComplete,
  onTimerWarning,
  isRunning = false,
  onToggleTimer,
  onResetTimer,
}: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState(
    examConfig.sections[currentSection].duration,
  );
  const [hasWarned, setHasWarned] = useState(false);

  // Resetear timer cuando cambia la sección
  useEffect(() => {
    setTimeLeft(examConfig.sections[currentSection].duration);
    setHasWarned(false);
  }, [currentSection, examConfig]);

  // Lógica del timer
  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        // Advertencia a los 2 minutos
        if (newTime === 120 && !hasWarned) {
          setHasWarned(true);
          onTimerWarning?.(currentSection, newTime);
        }

        // Sección completada
        if (newTime <= 0) {
          onSectionComplete?.(currentSection);
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isRunning,
    timeLeft,
    currentSection,
    hasWarned,
    onSectionComplete,
    onTimerWarning,
  ]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (timeLeft <= 60) return 'text-red-600 font-bold'; // Último minuto
    if (timeLeft <= 120) return 'text-orange-600 font-bold'; // Últimos 2 minutos
    return 'text-white';
  };

  const getProgressPercentage = (): number => {
    const totalDuration = examConfig.sections[currentSection].duration;
    return ((totalDuration - timeLeft) / totalDuration) * 100;
  };

  const sectionConfig = examConfig.sections[currentSection];

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
        {timeLeft <= 120 && timeLeft > 0 && (
          <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded text-sm text-orange-800 text-center">
            ⚠️ Quedan menos de 2 minutos
          </div>
        )}

        {timeLeft === 0 && (
          <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800 text-center">
            🔔 Tiempo completado para esta sección
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Legacy exports for backward compatibility
export type TeaSection = ExamSection;
export const TeaTimer = ExamTimer;
export type TeaTimerProps = ExamTimerProps;
