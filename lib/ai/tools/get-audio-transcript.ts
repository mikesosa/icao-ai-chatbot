import { tool } from 'ai';
import { z } from 'zod';

import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';

export const getAudioTranscript = ({
  examConfig,
}: {
  examConfig?: any;
}) =>
  tool({
    description: `Get transcript and correct answers for a specific recording during TEA exam evaluation. 
    Use this tool AFTER a candidate responds to audio to access the exact transcript and correct answers 
    for accurate comprehension evaluation.`,
    parameters: z.object({
      subsection: z
        .string()
        .describe('Exam subsection identifier (e.g., "2A", "2B", "2C")'),
      recordingNumber: z
        .number()
        .min(1)
        .max(6)
        .describe(
          'Specific recording number (1-6 for 2A, 1-4 for 2B, 1-3 for 2C)',
        ),
    }),
    execute: async ({ subsection, recordingNumber }) => {
      console.log('🎵 [GET AUDIO TRANSCRIPT] Starting execution with params:', {
        subsection,
        recordingNumber,
      });

      try {
        // Access exam configuration
        let config = examConfig;
        if (!config) {
          // Fallback to loading config from JSON data
          try {
            config = (examConfigsData as any)['tea-evaluator'];
          } catch (error) {
            console.error('Failed to load exam config:', error);
            return {
              success: false,
              error: 'Unable to access exam configuration',
            };
          }
        }

        // Navigate to the specific subsection and recording
        const sections = config?.examConfig?.sections;
        if (!sections || !sections['2']) {
          return {
            success: false,
            error: 'Section 2 configuration not found',
          };
        }

        const subsections = sections['2'].subsections;
        if (!subsections || !subsections[subsection]) {
          return {
            success: false,
            error: `Subsection ${subsection} not found`,
          };
        }

        const audioFiles = subsections[subsection].audioFiles;
        if (!audioFiles || !Array.isArray(audioFiles)) {
          return {
            success: false,
            error: `Audio files not found for subsection ${subsection}`,
          };
        }

        // Find the specific recording (recording numbers start at 1, array index at 0)
        const recordingIndex = recordingNumber - 1;
        if (recordingIndex < 0 || recordingIndex >= audioFiles.length) {
          return {
            success: false,
            error: `Recording ${recordingNumber} not found in subsection ${subsection}. Available recordings: 1-${audioFiles.length}`,
          };
        }

        const recording = audioFiles[recordingIndex];
        if (!recording) {
          return {
            success: false,
            error: `Recording data not found for ${subsection} recording ${recordingNumber}`,
          };
        }

        // Extract transcript and correct answers
        const transcript = recording.transcript;
        const correctAnswers = recording.correctAnswers;
        const title = recording.title;
        const description = recording.description;

        if (!transcript) {
          return {
            success: false,
            error: `Transcript not available for ${subsection} recording ${recordingNumber}`,
          };
        }

        console.log(
          '🎵 [GET AUDIO TRANSCRIPT] Successfully retrieved transcript and answers',
        );

        return {
          success: true,
          message: `Retrieved transcript and correct answers for ${subsection} recording ${recordingNumber}`,
          data: {
            subsection,
            recordingNumber,
            title,
            description,
            transcript,
            correctAnswers,
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
