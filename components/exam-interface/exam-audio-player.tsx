'use client';

import { useEffect } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { AudioPlayer } from '@/components/audio-player';
import { Button } from '@/components/ui/button';
import { useExamContext } from '@/hooks/use-exam-context';

interface ExamAudioPlayerProps {
  className?: string;
}

export function ExamAudioPlayer({ className }: ExamAudioPlayerProps) {
  const {
    currentSection,
    currentSubsection,
    examConfig,
    audioFiles,
    currentAudioIndex,
    setAudioFiles,
    setCurrentAudioIndex,
    getCurrentAudioFile,
    getAudioUrl,
    playNextAudio,
    playPreviousAudio,
  } = useExamContext();

  // Load audio files when subsection changes
  useEffect(() => {
    if (!examConfig || !currentSection || !currentSubsection) {
      setAudioFiles([]);
      return;
    }

    const sectionConfig =
      examConfig.examConfig.sections[Number(currentSection)];
    if (!sectionConfig?.subsections) {
      setAudioFiles([]);
      return;
    }

    const subsectionConfig = sectionConfig.subsections[currentSubsection];
    if (!subsectionConfig?.audioFiles) {
      setAudioFiles([]);
      return;
    }

    setAudioFiles(subsectionConfig.audioFiles);
    setCurrentAudioIndex(0); // Reset to first audio file
  }, [
    examConfig,
    currentSection,
    currentSubsection,
    setAudioFiles,
    setCurrentAudioIndex,
  ]);

  // Don't render if no audio files or not in a listening section
  if (!audioFiles.length || !currentSubsection) {
    return null;
  }

  const currentAudio = getCurrentAudioFile();
  if (!currentAudio) {
    return null;
  }

  const audioUrl = getAudioUrl(currentAudio.recording);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Audio Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={playPreviousAudio}
            disabled={currentAudioIndex === 0}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Recording {currentAudioIndex + 1} of {audioFiles.length}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={playNextAudio}
            disabled={currentAudioIndex === audioFiles.length - 1}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Audio Player */}
      <AudioPlayer
        src={audioUrl}
        title={currentAudio.title}
        description={currentAudio.description}
        className="w-full"
      />

      {/* Instructions */}
      <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
        <strong>Instructions:</strong>
        <ul className="mt-2 space-y-1">
          {examConfig?.examConfig.sections[
            Number(currentSection)
          ]?.subsections?.[currentSubsection]?.instructions?.map(
            (instruction: string, _index: number) => (
              <li
                key={`instruction-${currentSection}-${currentSubsection}-${instruction
                  .slice(0, 20)
                  .replace(/\s+/g, '-')}`}
                className="flex items-start gap-2"
              >
                <span className="text-primary">•</span>
                <span>{instruction}</span>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
