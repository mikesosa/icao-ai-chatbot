'use client';

import { useEffect } from 'react';

import { AudioPlayer } from '@/components/audio-player';
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
    setAudioFiles,
    setCurrentAudioIndex,
    getCurrentAudioFile,
    getAudioUrl,
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
      {/* Audio Player - Single Recording Only */}
      <AudioPlayer
        src={audioUrl}
        title={currentAudio.title}
        description={currentAudio.description}
        className="w-full"
      />
    </div>
  );
}
