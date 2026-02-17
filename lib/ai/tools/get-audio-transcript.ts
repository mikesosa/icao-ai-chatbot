import { tool } from 'ai';
import { z } from 'zod';

import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';

import { getExamTypeFromConfig } from './play-audio';

function getConfigFromFallback(examType: string) {
  if (examType === 'elpac') {
    return (
      (examConfigsData as any)['elpac-evaluator'] ||
      (examConfigsData as any)['elpac-demo']
    );
  }

  return (examConfigsData as any)['tea-evaluator'];
}

function getTeaTranscriptData(
  config: any,
  subsection: string,
  recordingNumber: number,
) {
  const sections = config?.examConfig?.sections;
  const sectionTwo = sections?.['2'];
  const subsectionConfig = sectionTwo?.subsections?.[subsection];
  const audioFiles = subsectionConfig?.audioFiles;

  if (!Array.isArray(audioFiles)) {
    return {
      success: false as const,
      error: `Audio files not found for subsection ${subsection}`,
    };
  }

  const recording =
    audioFiles.find((item: any) => item?.recording === recordingNumber) ||
    audioFiles[recordingNumber - 1];

  if (!recording) {
    return {
      success: false as const,
      error: `Recording ${recordingNumber} not found in subsection ${subsection}.`,
    };
  }

  return { success: true as const, recording };
}

function getElpacTranscriptData(
  config: any,
  subsection: string,
  recordingNumber: number,
) {
  const normalized = subsection.toUpperCase();

  if (normalized.startsWith('2')) {
    return {
      success: false as const,
      error:
        'Transcript lookup is not available for ELPAC Paper 2 oral interaction tasks.',
    };
  }

  if (!(normalized.startsWith('1P') || normalized === '1')) {
    return {
      success: false as const,
      error: `Unsupported ELPAC subsection ${subsection} for transcript lookup.`,
    };
  }

  const sectionOneAudioFiles = config?.examConfig?.sections?.['1']?.audioFiles;
  if (!Array.isArray(sectionOneAudioFiles)) {
    return {
      success: false as const,
      error: 'ELPAC Paper 1 audio configuration not found.',
    };
  }

  const recording =
    sectionOneAudioFiles.find(
      (item: any) => item?.recording === recordingNumber,
    ) || sectionOneAudioFiles[recordingNumber - 1];

  if (!recording) {
    return {
      success: false as const,
      error: `Recording ${recordingNumber} not found in ELPAC Paper 1.`,
    };
  }

  return { success: true as const, recording };
}

export const getAudioTranscript = ({
  examConfig,
}: {
  examConfig?: any;
}) =>
  tool({
    description: `Get transcript and correct answers for a specific exam recording.
Use this tool AFTER a candidate responds to an audio item for accurate comprehension evaluation.
Never reveal transcript text to the candidate.`,
    parameters: z.object({
      subsection: z
        .string()
        .describe('Exam subsection identifier (e.g., "2A", "1P1", "1P3")'),
      recordingNumber: z
        .number()
        .min(1)
        .max(6)
        .describe('Specific recording number to evaluate'),
    }),
    execute: async ({ subsection, recordingNumber }) => {
      try {
        const examType = getExamTypeFromConfig(examConfig);
        const config = examConfig || getConfigFromFallback(examType);

        if (!config?.examConfig?.sections) {
          return {
            success: false,
            error: 'Unable to access exam configuration',
          };
        }

        const result =
          examType === 'elpac'
            ? getElpacTranscriptData(config, subsection, recordingNumber)
            : getTeaTranscriptData(config, subsection, recordingNumber);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          };
        }

        const transcript = result.recording.transcript;
        if (!transcript) {
          return {
            success: false,
            error: `Transcript not available for ${subsection} recording ${recordingNumber}`,
          };
        }

        return {
          success: true,
          message: `Retrieved transcript and answer key metadata for ${subsection} recording ${recordingNumber}`,
          data: {
            subsection,
            recordingNumber,
            title: result.recording.title,
            description: result.recording.description,
            transcript,
            correctAnswers: result.recording.correctAnswers,
          },
        };
      } catch (error) {
        console.error('🎵 [GET AUDIO TRANSCRIPT] Error:', error);
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    },
  });
