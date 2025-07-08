'use client';

import {
  CheckCircle,
  Circle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  ExamSection,
  ExamSectionInfo,
  ExamControlsConfig,
  CompleteExamConfig,
} from './exam';

interface ExamSectionControlsProps {
  currentSection: ExamSection;
  currentSubsection: string | null;
  completedSections: ExamSection[];
  completedSubsections: string[];
  onSectionChange: (section: ExamSection) => void;
  onSubsectionChange: (subsection: string) => void;
  onStartExam?: () => void;
  onEndExam?: () => void;
  examStarted: boolean;
  isTimerRunning: boolean;
  controlsConfig: ExamControlsConfig;
  examConfig: CompleteExamConfig;
}

export function ExamSectionControls({
  currentSection,
  currentSubsection,
  completedSections,
  completedSubsections,
  onSectionChange,
  onSubsectionChange,
  onStartExam,
  onEndExam,
  examStarted,
  isTimerRunning,
  controlsConfig,
  examConfig,
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

  const getSubsectionStatus = (
    subsectionId: string,
  ): 'completed' | 'current' | 'pending' => {
    if (completedSubsections.includes(subsectionId)) return 'completed';
    if (subsectionId === currentSubsection) return 'current';
    return 'pending';
  };

  const getSectionSubsections = (sectionNumber: ExamSection) => {
    return examConfig.examConfig.sections[sectionNumber]?.subsections || {};
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
            const subsections = getSectionSubsections(section.number);
            const hasSubsections = Object.keys(subsections).length > 0;

            return (
              <div key={section.number} className="space-y-2">
                {/* Main Section */}
                <div
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

                  <div className="shrink-0 flex items-center gap-1">
                    {status === 'completed' && (
                      <CheckCircle className="size-4 text-green-600" />
                    )}
                    {status === 'current' && (
                      <Circle className="size-4 text-blue-600 fill-current" />
                    )}
                    {hasSubsections && (
                      <ChevronRight className="size-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Subsections */}
                {hasSubsections && status === 'current' && (
                  <div className="ml-6 space-y-1">
                    {Object.entries(subsections).map(
                      ([subsectionId, subsection]) => {
                        const subsectionStatus =
                          getSubsectionStatus(subsectionId);
                        return (
                          <div
                            key={subsectionId}
                            className={`flex items-center gap-2 p-2 rounded border transition-all cursor-pointer text-sm
                            ${
                              subsectionStatus === 'current'
                                ? 'border-blue-300 bg-blue-50'
                                : subsectionStatus === 'completed'
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                            onClick={() => onSubsectionChange(subsectionId)}
                          >
                            <div className="shrink-0">
                              {subsectionStatus === 'completed' ? (
                                <CheckCircle className="size-3 text-green-600" />
                              ) : subsectionStatus === 'current' ? (
                                <Circle className="size-3 text-blue-600 fill-current" />
                              ) : (
                                <Circle className="size-3 text-gray-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-xs">
                                {subsectionId}: {subsection.name}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {subsection.description}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                )}
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
