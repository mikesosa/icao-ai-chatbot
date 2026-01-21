'use client';

import { useMemo } from 'react';

import { CheckCircle, Circle, Play, Square } from 'lucide-react';
import { useSession } from 'next-auth/react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type {
  CompleteExamConfig,
  ExamControlsConfig,
  ExamSection,
} from './exam';

interface ExamSectionControlsProps {
  currentSection: ExamSection;
  currentSubsection: string | null;
  completedSections: ExamSection[];
  completedSubsections: string[];
  onSectionChange: (section: ExamSection) => void;
  onSubsectionChange: (subsection: string) => void;
  onStartExam?: () => void;
  onEndExamRequest?: (opts: { generateReport: boolean }) => void;
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
  onEndExamRequest,
  examStarted,
  controlsConfig,
  examConfig,
}: ExamSectionControlsProps) {
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const isAdmin = userType === 'admin';
  const allowJump = process.env.NODE_ENV === 'development';

  // Get current section's subsections
  const currentSectionSubsections = useMemo(
    () => examConfig.examConfig.sections[currentSection]?.subsections || {},
    [examConfig, currentSection],
  );
  const hasSubsections = Object.keys(currentSectionSubsections).length > 0;

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {/* Section Navigation */}
          {examStarted && (
            <div className="space-y-4 mb-4">
              {/* Current Section Display */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Current Section</h3>
                <Badge variant="outline">
                  Section {currentSection} of {controlsConfig.totalSections}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {Array.from(
                  { length: controlsConfig.totalSections },
                  (_, i) => {
                    const sectionNum = i + 1;
                    const isCompleted = completedSections.includes(sectionNum);
                    const isCurrent = currentSection === sectionNum;
                    const sectionInfo = controlsConfig.sections[i];

                    return (
                      <Button
                        key={sectionNum}
                        variant={isCurrent ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSectionChange(sectionNum)}
                        disabled={!allowJump}
                        className="justify-start h-auto py-3"
                      >
                        <div className="flex items-center gap-1">
                          {isCompleted && (
                            <CheckCircle className="size-4 text-green-500" />
                          )}
                          <span className="font-medium">
                            Section {sectionNum}:
                          </span>
                          <span className="font-medium">
                            {sectionInfo?.title || `Section ${sectionNum}`}
                          </span>
                        </div>
                      </Button>
                    );
                  },
                )}
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
                            disabled={!allowJump}
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Exam {controlsConfig.name} {examStarted ? ' - In progress' : ''}
            </span>
            {isAdmin && (
              <Badge variant="destructive" className="text-xs ml-2">
                Admin Mode
              </Badge>
            )}
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="w-full fill-current"
                    variant="destructive"
                    size="lg"
                  >
                    <Square className="size-4 mr-2" />
                    End Exam
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End exam?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop the exam immediately. If you end early, you
                      can optionally request a partial evaluation based on what
                      was completed so far.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        onEndExamRequest?.({ generateReport: false })
                      }
                    >
                      End (no report)
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={() =>
                        onEndExamRequest?.({ generateReport: true })
                      }
                    >
                      End & generate report
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
