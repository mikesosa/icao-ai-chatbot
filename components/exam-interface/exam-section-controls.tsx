'use client';

import {
  CheckCircle,
  Circle,
  ChevronRight,
  Play,
  Square,
  ChevronLeft,
} from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type {
  ExamSection,
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
  controlsConfig,
  examConfig,
}: ExamSectionControlsProps) {
  const canGoToPrevious = currentSection > 1;
  const canGoToNext = currentSection < controlsConfig.totalSections;

  // Get current section's subsections
  const currentSectionSubsections =
    examConfig.examConfig.sections[currentSection]?.subsections || {};
  const hasSubsections = Object.keys(currentSectionSubsections).length > 0;

  // Auto-select first subsection when entering a section with subsections but no current subsection
  useEffect(() => {
    if (examStarted && hasSubsections && !currentSubsection) {
      const firstSubsectionId = Object.keys(currentSectionSubsections)[0];
      if (firstSubsectionId) {
        onSubsectionChange(firstSubsectionId);
      }
    }
  }, [
    currentSection,
    hasSubsections,
    currentSubsection,
    examStarted,
    onSubsectionChange,
    currentSectionSubsections,
  ]);

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
                  disabled={!canGoToPrevious}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSectionChange(1)}
                  disabled={!canGoToNext}
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
                      const sectionInfo = controlsConfig.sections[i];

                      return (
                        <Button
                          key={sectionNum}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSectionChange(sectionNum)}
                          disabled={false}
                          className="justify-start h-auto py-3"
                        >
                          <div className="flex flex-col items-start gap-1 text-left">
                            <div className="flex items-center gap-2">
                              {isCompleted && (
                                <CheckCircle className="size-4 text-green-500" />
                              )}
                              <span className="font-medium">
                                Section {sectionNum}:{' '}
                                {sectionInfo?.title || `Section ${sectionNum}`}
                              </span>
                            </div>
                          </div>
                        </Button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Subsection Controls */}
              {hasSubsections && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Subsections</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(currentSectionSubsections).map(
                      ([subsectionId, subsection]) => {
                        const isCompleted =
                          completedSubsections.includes(subsectionId);
                        const isCurrent = currentSubsection === subsectionId;

                        return (
                          <Button
                            key={subsectionId}
                            variant={isCurrent ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onSubsectionChange(subsectionId)}
                            disabled={false}
                            className={`justify-start ${
                              isCurrent
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isCurrent && !isCompleted && (
                                <Circle className="size-4 fill-current" />
                              )}
                              {isCompleted && (
                                <CheckCircle className="size-4 text-green-500" />
                              )}
                              <span className={isCurrent ? 'font-medium' : ''}>
                                {subsection.name}
                              </span>
                            </div>
                          </Button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Exam status:</span>
            <Badge variant="outline">
              {examStarted ? 'In progress' : 'Not started'}
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
