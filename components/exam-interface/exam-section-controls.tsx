'use client';

import {
  CheckCircle,
  Circle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Headphones,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExamSection } from './exam-timer';

export interface ExamSectionInfo {
  number: ExamSection;
  title: string;
  description: string;
  icon: React.ReactNode;
  duration: string;
}

export interface ExamControlsConfig {
  name: string;
  totalSections: number;
  sections: ExamSectionInfo[];
  totalDuration: string;
  startButtonText: string;
  finishButtonText: string;
}

// Default TEA configuration for backward compatibility
export const TEA_CONTROLS_CONFIG: ExamControlsConfig = {
  name: 'TEA',
  totalSections: 3,
  sections: [
    {
      number: 1,
      title: 'Entrevista y Experiencia',
      description: 'Preguntas sobre rol profesional y experiencia en aviación',
      icon: <FileText className="size-5" />,
      duration: '7-8 min',
    },
    {
      number: 2,
      title: 'Comprensión Interactiva',
      description: 'Escucha situaciones aeronáuticas y demuestra comprensión',
      icon: <Headphones className="size-5" />,
      duration: '8-12 min',
    },
    {
      number: 3,
      title: 'Descripción y Discusión',
      description: 'Describe imágenes y participa en discusión general',
      icon: <MessageSquare className="size-5" />,
      duration: '10 min',
    },
  ],
  totalDuration: '25-30 minutos',
  startButtonText: 'Iniciar Examen TEA',
  finishButtonText: 'Finalizar Examen',
};

interface ExamSectionControlsProps {
  currentSection: ExamSection;
  completedSections: ExamSection[];
  onSectionChange: (section: ExamSection) => void;
  onStartExam?: () => void;
  onEndExam?: () => void;
  examStarted: boolean;
  isTimerRunning: boolean;
  controlsConfig?: ExamControlsConfig;
}

export function ExamSectionControls({
  currentSection,
  completedSections,
  onSectionChange,
  onStartExam,
  onEndExam,
  examStarted,
  isTimerRunning,
  controlsConfig = TEA_CONTROLS_CONFIG,
}: ExamSectionControlsProps) {
  const canGoToPrevious = currentSection > 1;
  const canGoToNext = currentSection < controlsConfig.totalSections;
  const allSectionsCompleted =
    completedSections.length === controlsConfig.totalSections;

  const getSectionStatus = (
    sectionNumber: ExamSection,
  ): 'completed' | 'current' | 'pending' => {
    if (completedSections.includes(sectionNumber)) return 'completed';
    if (sectionNumber === currentSection) return 'current';
    return 'pending';
  };

  const getSectionBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'current':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSectionIcon = (section: ExamSectionInfo, status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="size-5 text-green-600" />;
    }
    return section.icon;
  };

  return (
    <Card className="w-full bg-sidebar">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Examen {controlsConfig.name} {examStarted ? ' - In progress' : ''}
          </span>
          <Badge variant={allSectionsCompleted ? 'default' : 'secondary'}>
            {completedSections.length}/{controlsConfig.totalSections} secciones
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Section Progress */}
        <div className="space-y-3">
          {controlsConfig.sections.map((section) => {
            const status = getSectionStatus(section.number);
            return (
              <div
                key={section.number}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
                  ${
                    status === 'current'
                      ? 'border-blue-500 '
                      : status === 'completed'
                      ? 'border-green-500 '
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => onSectionChange(section.number)}
              >
                <div className="shrink-0">
                  {getSectionIcon(section, status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">
                      {section.number}. {section.title}
                    </h4>
                    <Badge
                      variant={getSectionBadgeVariant(status)}
                      className="text-xs"
                    >
                      {section.duration}
                    </Badge>
                  </div>
                </div>

                <div className="shrink-0">
                  {status === 'completed' && (
                    <CheckCircle className="size-4 text-green-600" />
                  )}
                  {status === 'current' && (
                    <Circle className="size-4 text-blue-600 fill-current" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Controls */}
        {examStarted && (
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={() =>
                onSectionChange((currentSection - 1) as ExamSection)
              }
              disabled={!canGoToPrevious || isTimerRunning}
              className="flex items-center gap-1"
            >
              <ArrowLeft className="size-4" />
              Anterior
            </Button>

            <div className="text-sm text-gray-600">
              Sección {currentSection} de {controlsConfig.totalSections}
            </div>

            {canGoToNext ? (
              <Button
                variant="outline"
                onClick={() =>
                  onSectionChange((currentSection + 1) as ExamSection)
                }
                disabled={isTimerRunning}
                className="flex items-center gap-1"
              >
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={onEndExam}
                disabled={!allSectionsCompleted}
                className="flex items-center gap-1"
              >
                {allSectionsCompleted
                  ? controlsConfig.finishButtonText
                  : 'Completar Todo'}
              </Button>
            )}
          </div>
        )}

        {/* Start Exam Button */}
        {!examStarted && (
          <div className="pt-4 border-t">
            <Button onClick={onStartExam} className="w-full" size="lg">
              {controlsConfig.startButtonText}
            </Button>
            <p className="text-xs text-gray-300 text-center mt-4">
              Duración total: {controlsConfig.totalDuration}
            </p>
          </div>
        )}

        {/* Exam Status */}
        {examStarted && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Estado del examen:</span>
              <Badge variant={isTimerRunning ? 'default' : 'outline'}>
                {isTimerRunning ? 'En progreso' : 'Pausado'}
              </Badge>
            </div>

            {allSectionsCompleted && (
              <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800 text-center">
                ✅ Todas las secciones completadas. Puede finalizar el examen.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Legacy exports for backward compatibility
export type TeaSection = ExamSection;
export type TeaSectionInfo = ExamSectionInfo;
export const TeaSectionControls = ExamSectionControls;
export type TeaSectionControlsProps = ExamSectionControlsProps;
