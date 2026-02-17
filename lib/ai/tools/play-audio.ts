import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

const STRICT_EXAM_PLAYBACK_POLICY = {
  allowSeek: false,
  maxReplays: 1,
} as const;

const DEFAULT_PLAYBACK_POLICY = {
  allowSeek: true,
  maxReplays: 99,
} as const;

type ElpacRoutingResult =
  | {
      success: true;
      subsection: string;
      examSection: '1' | '2';
      mode: 'recording' | 'prompt';
      recordingNumber: number;
    }
  | {
      success: false;
      error: string;
    };

// Function to get available audio files
async function getAvailableAudioFiles(): Promise<string[]> {
  try {
    const audioDir = join(process.cwd(), 'app', '(chat)', 'api', 'audio');
    const files = await readdir(audioDir);

    // Filter for .mp3 files only
    const audioFiles = files.filter(
      (file) => file.endsWith('.mp3') && !file.startsWith('.'),
    );

    return audioFiles.length > 0
      ? audioFiles
      : [
          'audio1.mp3',
          'audio2.mp3',
          'audio3.mp3',
          'audio4.mp3',
          'audio5.mp3',
          'audio6.mp3',
        ];
  } catch (error) {
    console.warn('Could not read audio directory, using fallback list:', error);
    // Fallback to known files if directory read fails
    return [
      'audio1.mp3',
      'audio2.mp3',
      'audio3.mp3',
      'audio4.mp3',
      'audio5.mp3',
      'audio6.mp3',
    ];
  }
}

export function getExamTypeFromConfig(examConfig?: { id?: string }): string {
  if (!examConfig?.id) {
    return 'tea';
  }

  return examConfig.id.replace('-evaluator', '').replace('-demo', '');
}

function getConfiguredSubsectionRecording(
  examConfig: any,
  subsection: string,
): number | undefined {
  const normalizedSubsection = subsection.toUpperCase();

  const sectionKey = normalizedSubsection.startsWith('1P')
    ? '1'
    : normalizedSubsection.startsWith('2')
      ? '2'
      : normalizedSubsection.charAt(0);

  const subsectionConfig =
    examConfig?.examConfig?.sections?.[sectionKey]?.subsections?.[
      normalizedSubsection
    ];
  const configuredRecording = subsectionConfig?.audioFiles?.[0]?.recording;

  return typeof configuredRecording === 'number'
    ? configuredRecording
    : undefined;
}

export function resolveElpacExamRouting({
  subsection,
  recordingNumber,
  examConfig,
}: {
  subsection?: string;
  recordingNumber?: number;
  examConfig?: any;
}): ElpacRoutingResult {
  if (!subsection) {
    if (typeof recordingNumber === 'number') {
      if (recordingNumber < 1 || recordingNumber > 6) {
        return {
          success: false,
          error:
            'Invalid ELPAC listening recording number. Expected a value between 1 and 6.',
        };
      }

      return {
        success: true,
        subsection: '1',
        examSection: '1',
        mode: 'recording',
        recordingNumber,
      };
    }

    return {
      success: false,
      error:
        'ELPAC exam recordings require subsection or recordingNumber (supported subsections: 1P1-1P6, 2I).',
    };
  }

  const normalized = subsection.toUpperCase();

  if (/^1P[1-6]$/.test(normalized)) {
    const configuredRecording =
      getConfiguredSubsectionRecording(examConfig, normalized) ??
      Number.parseInt(normalized.slice(2), 10);

    const selectedRecording = recordingNumber ?? configuredRecording;

    if (selectedRecording < 1 || selectedRecording > 6) {
      return {
        success: false,
        error:
          'Invalid ELPAC listening recording number. Expected a value between 1 and 6.',
      };
    }

    if (
      typeof recordingNumber === 'number' &&
      recordingNumber !== configuredRecording
    ) {
      return {
        success: false,
        error: `Invalid ELPAC subsection/recording combination: ${normalized} must use recording ${configuredRecording}.`,
      };
    }

    return {
      success: true,
      subsection: normalized,
      examSection: '1',
      mode: 'recording',
      recordingNumber: selectedRecording,
    };
  }

  if (normalized === '2I' || normalized === '2') {
    const configuredRecording =
      getConfiguredSubsectionRecording(examConfig, '2I') ?? 1;
    const selectedRecording = recordingNumber ?? configuredRecording;

    if (selectedRecording < 1 || selectedRecording > 3) {
      return {
        success: false,
        error:
          'Invalid ELPAC Task I prompt number. Expected a value between 1 and 3.',
      };
    }

    if (
      typeof recordingNumber === 'number' &&
      recordingNumber !== configuredRecording
    ) {
      return {
        success: false,
        error: `Invalid ELPAC subsection/recording combination: 2I must use recording ${configuredRecording}.`,
      };
    }

    return {
      success: true,
      subsection: '2I',
      examSection: '2',
      mode: 'prompt',
      recordingNumber: selectedRecording,
    };
  }

  if (normalized === '2II' || normalized === '2III') {
    return {
      success: false,
      error:
        'ELPAC visual tasks (2II/2III) do not support playAudio. Use displayImage instead.',
    };
  }

  return {
    success: false,
    error: `Unsupported ELPAC subsection "${subsection}". Supported values: 1P1-1P6 and 2I.`,
  };
}

export const playAudioTool = ({
  session: _session,
  dataStream,
  examConfig,
  requestState,
}: {
  session: Session;
  dataStream: DataStreamWriter;
  examConfig?: any;
  requestState?: { playAudioCalledThisRequest: boolean };
}) =>
  tool({
    description: `Play audio files for exam listening comprehension exercises.
    Automatically discovers and randomly selects from available .mp3 audio files in the system.
    Use this tool to present listening exercises during any exam that requires audio content.
    This tool creates a unified audio player that works for both exam and general audio playback.`,
    parameters: z.object({
      title: z
        .string()
        .describe(
          'Title for the audio exercise (e.g., "Recording 1 - Non-routine Situation", "Listening Part A")',
        ),
      description: z
        .string()
        .optional()
        .describe(
          'Optional description of what the audio contains or instructions',
        ),
      subsection: z
        .string()
        .optional()
        .describe(
          'Exam subsection identifier (e.g., "2A", "Part 1", "Listening Section")',
        ),
      recordingNumber: z
        .number()
        .min(1)
        .max(6)
        .optional()
        .describe(
          'Specific recording number to play (1-6). If not provided, will select randomly.',
        ),
      isExamRecording: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Whether this is an exam recording (affects UI and behavior)',
        ),
      recordingId: z
        .string()
        .optional()
        .describe(
          'Unique identifier for the recording (auto-generated if not provided)',
        ),
    }),
    execute: async ({
      title,
      description,
      subsection,
      recordingNumber,
      isExamRecording = false,
      recordingId,
    }) => {
      try {
        // Prevent the model from presenting multiple exam recordings in a single request/turn.
        // This avoids skipping items (Item 3 -> Item 4) and premature advancement.
        if (isExamRecording && requestState?.playAudioCalledThisRequest) {
          console.warn(
            '🎵 [PLAY AUDIO TOOL] Blocked duplicate playAudio call in the same request',
          );
          return {
            success: false,
            message:
              'Audio already presented this turn. Wait for the candidate response before presenting the next item.',
            error: 'duplicate_play_audio_same_request',
          };
        }
        if (isExamRecording && requestState) {
          requestState.playAudioCalledThisRequest = true;
        }

        // Dynamically get available audio files
        const audioFiles = await getAvailableAudioFiles();

        if (audioFiles.length === 0) {
          console.warn('🎵 [PLAY AUDIO TOOL] No audio files available');
          return {
            success: false,
            message: 'No audio files available',
            error: 'No .mp3 files found in the audio directory',
          };
        }

        // Extract exam type from examConfig
        const examType = getExamTypeFromConfig(examConfig);
        let finalSubsection = subsection;
        let finalRecordingNumber = recordingNumber;
        const playbackPolicy = isExamRecording
          ? STRICT_EXAM_PLAYBACK_POLICY
          : DEFAULT_PLAYBACK_POLICY;

        let audioFile: string;
        let audioUrl: string;

        if (isExamRecording && examType === 'elpac') {
          const routing = resolveElpacExamRouting({
            subsection,
            recordingNumber,
            examConfig,
          });

          if (!routing.success) {
            return {
              success: false,
              message: routing.error,
              error: 'invalid_elpac_audio_mapping',
            };
          }

          finalSubsection = routing.subsection;
          finalRecordingNumber = routing.recordingNumber;
          const padded = routing.recordingNumber.toString().padStart(2, '0');

          if (routing.mode === 'prompt') {
            audioFile = `elpac-2-speaking-prompt-${padded}.mp3`;
            audioUrl = `/api/audio?exam=elpac&section=2&prompt=${routing.recordingNumber}`;
          } else {
            audioFile = `elpac-1-listening-${padded}.mp3`;
            audioUrl = `/api/audio?exam=elpac&section=1&recording=${routing.recordingNumber}`;
          }
        } else if (isExamRecording && subsection) {
          // For exam recordings with specific number, construct the filename.
          const rawSection = subsection.toLowerCase();
          const examSection = rawSection;
          const recording = finalRecordingNumber || 1;
          const padded = recording.toString().padStart(2, '0');

          audioFile = `${examSection}-recording-${padded}.mp3`;
          audioUrl = `/api/audio?exam=${examType}&section=${examSection}&recording=${recording}`;
          finalRecordingNumber = recording;
        } else {
          // Randomly select an audio file (general fallback behavior)
          audioFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
          audioUrl = `/api/audio?file=${audioFile}`;
        }

        // Generate recording ID if not provided
        const finalRecordingId =
          recordingId ||
          `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Prepare audio player data
        const audioPlayerData = {
          type: 'audio-player',
          content: {
            src: audioUrl,
            title,
            description: description || '',
            subsection: finalSubsection || '',
            audioFile,
            recordingId: finalRecordingId,
            isExamRecording,
            allowSeek: playbackPolicy.allowSeek,
            maxReplays: playbackPolicy.maxReplays,
          },
        };

        // Send audio player data to the data stream
        dataStream.writeData(audioPlayerData);

        // Return success message with details for the AI
        const selectionMethod = finalRecordingNumber
          ? `specific recording #${finalRecordingNumber}`
          : `randomly selected from ${audioFiles.length} available files`;
        const result = {
          success: true,
          message: `Audio player created for ${audioFile} (${selectionMethod})`,
          details: {
            audioFile,
            title,
            description,
            subsection: finalSubsection,
            recordingNumber: finalRecordingNumber,
            recordingId: finalRecordingId,
            isExamRecording,
            url: audioUrl,
            availableFiles: audioFiles.length,
            selectionMethod,
            examType,
            allowSeek: playbackPolicy.allowSeek,
            maxReplays: playbackPolicy.maxReplays,
          },
        };
        return result;
      } catch (error) {
        console.error(
          '🎵 [PLAY AUDIO TOOL] Error creating audio player:',
          error,
        );
        return {
          success: false,
          message: 'Failed to create audio player',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  });
