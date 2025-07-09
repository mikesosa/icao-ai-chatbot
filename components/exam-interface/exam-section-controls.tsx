'use client';

import {
  CheckCircle,
  Circle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Play,
  Square,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

  const handleSectionChange = (direction: 1 | -1) => {
    if (direction === 1 && canGoToNext) {
      onSectionChange((currentSection + 1) as ExamSection);
    } else if (direction === -1 && canGoToPrevious) {
      onSectionChange((currentSection - 1) as ExamSection);
    }
  };

  return (
    <Card className="w-full bg-sidebar">
      <CardHeader>
        <CardTitle className="text-lg">
          Exam {controlsConfig.name} {examStarted ? ' - In progress' : ''}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Start/End Exam Controls */}
        <div className="flex flex-col gap-3">
          {!examStarted ? (
            <Button
              onClick={onStartExam}
              className="w-full"
              variant="default"
              size="lg"
            >
              <Play className="size-4 mr-2" />
              Start Exam
            </Button>
          ) : (
            <Button
              onClick={onEndExam}
              className="w-full fill-current"
              variant="destructive"
              size="lg"
            >
              <Square className="size-4 mr-2" />
              End Exam
            </Button>
          )}
        </div>

        {/* Section Navigation */}
        {examStarted && (
          <>
            <Separator />
            <div className="space-y-4">
              {/* Current Section Display */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Current Section</h3>
                <Badge variant="outline">
                  Section {currentSection} of {controlsConfig.totalSections}
                </Badge>
              </div>

              {/* Section Controls */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSectionChange(-1)}
                  disabled={!canGoToPrevious || isTimerRunning}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSectionChange(1)}
                  disabled={!canGoToNext || isTimerRunning}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* Section List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Sections</h4>
                <div className="grid grid-cols-1 gap-2">
                  {Array.from(
                    { length: controlsConfig.totalSections },
                    (_, i) => {
                      const sectionNum = i + 1;
                      const isCompleted =
                        completedSections.includes(sectionNum);
                      const isCurrent = currentSection === sectionNum;

                      return (
                        <Button
                          key={sectionNum}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSectionChange(sectionNum)}
                          disabled={isTimerRunning}
                          className="justify-start"
                        >
                          <div className="flex items-center gap-2">
                            {isCompleted && (
                              <CheckCircle className="size-4 text-green-500" />
                            )}
                            Section {sectionNum}
                          </div>
                        </Button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Subsection Controls */}
              {examConfig.examConfig.sections[currentSection]?.subsections && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Subsections</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(
                      examConfig.examConfig.sections[currentSection]
                        .subsections || {},
                    ).map(([subsectionId, subsection]) => {
                      const isCompleted =
                        completedSubsections.includes(subsectionId);
                      const isCurrent = currentSubsection === subsectionId;

                      return (
                        <Button
                          key={subsectionId}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSubsectionChange(subsectionId)}
                          disabled={isTimerRunning}
                          className="justify-start"
                        >
                          <div className="flex items-center gap-2">
                            {isCompleted && (
                              <CheckCircle className="size-4 text-green-500" />
                            )}
                            {subsection.name}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Completion Actions */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSectionChange(currentSection)}
                  className="w-full"
                >
                  {completedSections.includes(currentSection)
                    ? 'Mark as Incomplete'
                    : 'Complete All'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Exam status:</span>
            <Badge variant={isTimerRunning ? 'default' : 'outline'}>
              {isTimerRunning ? 'In progress' : 'Paused'}
            </Badge>
          </div>
          {completedSections.length === controlsConfig.totalSections && (
            <div className="text-sm text-green-600">
              ✅ All sections completed. You can end the exam.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
