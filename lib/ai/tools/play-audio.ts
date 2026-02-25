import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

const DEFAULT_PLAYBACK_POLICY = {
  allowSeek: true,
  allowPause: true,
  maxReplays: 99,
} as const;

const DEFAULT_EXAM_PLAYBACK_POLICY = {
  allowSeek: false,
  allowPause: true,
  maxReplays: 1,
} as const;

type PlaybackPolicy = {
  allowSeek: boolean;
  allowPause: boolean;
  maxReplays: number;
};

type RoutingScope = 'section' | 'subsection';

type RoutingSourceType =
  | 'subsection-audio'
  | 'section-audio'
  | 'speaking-prompt';

type ResolvedExamAudioRouting =
  | {
      success: true;
      sectionKey: string;
      subsectionKey: string;
      apiSection: string;
      recordingNumber: number;
      sourceType: RoutingSourceType;
    }
  | {
      success: false;
      error: string;
    };

type PlayAudioRoutingConfig = {
  routeScope: RoutingScope;
  defaultSection?: string;
};

type PlayAudioFileTemplates = {
  recording?: string;
  speakingPrompt?: string;
};

type CandidateRouting = {
  sectionKey: string;
  subsectionKey: string;
  sourceType: RoutingSourceType;
  recordings: number[];
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

    return audioFiles;
  } catch (error) {
    console.warn('Could not read audio directory:', error);
    return [];
  }
}

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function getRecordingNumbersFromAudioFiles(audioFiles: unknown): number[] {
  if (!Array.isArray(audioFiles)) {
    return [];
  }

  return audioFiles
    .map((item: any) => item?.recording)
    .filter(isPositiveInteger)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function getPromptNumbersFromSection(sectionConfig: any): number[] {
  if (!Array.isArray(sectionConfig?.speakingPrompts)) {
    return [];
  }

  return sectionConfig.speakingPrompts
    .map((prompt: any) => prompt?.prompt)
    .filter(isPositiveInteger)
    .filter((value: number, index: number, all: number[]) => {
      return all.indexOf(value) === index;
    });
}

function getExamSections(examConfig: any): Record<string, any> {
  return examConfig?.examConfig?.sections ?? {};
}

function findSectionKey(
  sections: Record<string, any>,
  requestedKey: string,
): string | null {
  const normalized = normalizeKey(requestedKey);

  for (const sectionKey of Object.keys(sections)) {
    if (normalizeKey(sectionKey) === normalized) {
      return sectionKey;
    }
  }

  return null;
}

function findSubsection(
  sections: Record<string, any>,
  requestedSubsection: string,
): {
  sectionKey: string;
  subsectionKey: string;
  sectionConfig: any;
  subsectionConfig: any;
} | null {
  const normalized = normalizeKey(requestedSubsection);

  for (const [sectionKey, sectionConfig] of Object.entries(sections)) {
    const subsections = sectionConfig?.subsections ?? {};

    for (const [subsectionKey, subsectionConfig] of Object.entries(
      subsections,
    )) {
      if (normalizeKey(subsectionKey) === normalized) {
        return {
          sectionKey,
          subsectionKey,
          sectionConfig,
          subsectionConfig,
        };
      }
    }
  }

  return null;
}

function getConfiguredRouting(examConfig: any): PlayAudioRoutingConfig {
  const config = examConfig?.toolingConfig?.playAudio?.routing ?? {};
  const routeScope: RoutingScope =
    config.routeScope === 'section' ? 'section' : 'subsection';

  return {
    routeScope,
    defaultSection:
      typeof config.defaultSection === 'string' && config.defaultSection.trim()
        ? config.defaultSection
        : undefined,
  };
}

function getConfiguredFileTemplates(examConfig: any): PlayAudioFileTemplates {
  const templates = examConfig?.toolingConfig?.playAudio?.fileTemplates ?? {};

  return {
    recording:
      typeof templates.recording === 'string' && templates.recording.trim()
        ? templates.recording
        : undefined,
    speakingPrompt:
      typeof templates.speakingPrompt === 'string' &&
      templates.speakingPrompt.trim()
        ? templates.speakingPrompt
        : undefined,
  };
}

function resolveSectionCandidate(
  sectionKey: string,
  sectionConfig: any,
): CandidateRouting | null {
  const sectionPromptRecordings = getPromptNumbersFromSection(sectionConfig);
  if (sectionPromptRecordings.length > 0) {
    return {
      sectionKey,
      subsectionKey: sectionKey,
      sourceType: 'speaking-prompt',
      recordings: sectionPromptRecordings,
    };
  }

  const sectionAudioRecordings = getRecordingNumbersFromAudioFiles(
    sectionConfig?.audioFiles,
  );
  if (sectionAudioRecordings.length > 0) {
    return {
      sectionKey,
      subsectionKey: sectionKey,
      sourceType: 'section-audio',
      recordings: sectionAudioRecordings,
    };
  }

  return null;
}

function resolveSubsectionCandidate(
  sectionKey: string,
  subsectionKey: string,
  sectionConfig: any,
  subsectionConfig: any,
): CandidateRouting | null {
  const subsectionAudioRecordings = getRecordingNumbersFromAudioFiles(
    subsectionConfig?.audioFiles,
  );
  if (subsectionAudioRecordings.length > 0) {
    return {
      sectionKey,
      subsectionKey,
      sourceType: 'subsection-audio',
      recordings: subsectionAudioRecordings,
    };
  }

  if (subsectionConfig?.audioSource === 'sectionSpeakingPrompts') {
    const sectionPromptRecordings = getPromptNumbersFromSection(sectionConfig);
    if (sectionPromptRecordings.length > 0) {
      return {
        sectionKey,
        subsectionKey,
        sourceType: 'speaking-prompt',
        recordings: sectionPromptRecordings,
      };
    }
  }

  if (subsectionConfig?.audioSource === 'sectionAudio') {
    const sectionAudioRecordings = getRecordingNumbersFromAudioFiles(
      sectionConfig?.audioFiles,
    );
    if (sectionAudioRecordings.length > 0) {
      return {
        sectionKey,
        subsectionKey,
        sourceType: 'section-audio',
        recordings: sectionAudioRecordings,
      };
    }
  }

  return null;
}

function pickDefaultCandidate(
  sections: Record<string, any>,
  defaultSection?: string,
): CandidateRouting | null {
  if (defaultSection) {
    const defaultSubsection = findSubsection(sections, defaultSection);
    if (defaultSubsection) {
      return resolveSubsectionCandidate(
        defaultSubsection.sectionKey,
        defaultSubsection.subsectionKey,
        defaultSubsection.sectionConfig,
        defaultSubsection.subsectionConfig,
      );
    }

    const sectionKey = findSectionKey(sections, defaultSection);
    if (sectionKey) {
      const sectionCandidate = resolveSectionCandidate(
        sectionKey,
        sections[sectionKey],
      );
      if (sectionCandidate) {
        return sectionCandidate;
      }
    }
  }

  for (const [sectionKey, sectionConfig] of Object.entries(sections)) {
    const sectionCandidate = resolveSectionCandidate(sectionKey, sectionConfig);
    if (sectionCandidate) {
      return sectionCandidate;
    }

    const subsections = sectionConfig?.subsections ?? {};
    for (const [subsectionKey, subsectionConfig] of Object.entries(
      subsections,
    )) {
      const subsectionCandidate = resolveSubsectionCandidate(
        sectionKey,
        subsectionKey,
        sectionConfig,
        subsectionConfig,
      );
      if (subsectionCandidate) {
        return subsectionCandidate;
      }
    }
  }

  return null;
}

function getConfiguredExamPlaybackPolicy(examConfig: any): PlaybackPolicy {
  const configured = examConfig?.toolingConfig?.playAudio?.playbackPolicy ?? {};
  const allowSeek =
    typeof configured.allowSeek === 'boolean'
      ? configured.allowSeek
      : DEFAULT_EXAM_PLAYBACK_POLICY.allowSeek;
  const allowPause =
    typeof configured.allowPause === 'boolean'
      ? configured.allowPause
      : DEFAULT_EXAM_PLAYBACK_POLICY.allowPause;
  const maxReplays = isNonNegativeInteger(configured.maxReplays)
    ? configured.maxReplays
    : DEFAULT_EXAM_PLAYBACK_POLICY.maxReplays;

  return {
    allowSeek,
    allowPause,
    maxReplays,
  };
}

function applyAudioFileTemplate({
  template,
  examType,
  section,
  recording,
}: {
  template: string;
  examType: string;
  section: string;
  recording: number;
}): string {
  const padded = recording.toString().padStart(2, '0');

  return template
    .replaceAll('{{exam}}', examType)
    .replaceAll('{{section}}', section)
    .replaceAll('{{recording}}', String(recording))
    .replaceAll('{{num2}}', padded);
}

export function getExamTypeFromConfig(examConfig?: { id?: string }): string {
  if (!examConfig?.id) {
    return 'tea';
  }

  return examConfig.id.replace('-evaluator', '').replace('-demo', '');
}

export function resolvePlaybackPolicy({
  isExamRecording,
  examConfig,
}: {
  isExamRecording: boolean;
  examConfig?: any;
}): PlaybackPolicy {
  if (!isExamRecording) {
    return DEFAULT_PLAYBACK_POLICY;
  }

  return getConfiguredExamPlaybackPolicy(examConfig);
}

export function resolveExamAudioRouting({
  subsection,
  recordingNumber,
  examConfig,
}: {
  subsection?: string;
  recordingNumber?: number;
  examConfig?: any;
}): ResolvedExamAudioRouting {
  const sections = getExamSections(examConfig);
  const sectionKeys = Object.keys(sections);

  if (sectionKeys.length === 0) {
    return {
      success: false,
      error: 'Exam audio configuration is missing sections.',
    };
  }

  const routing = getConfiguredRouting(examConfig);

  let candidate: CandidateRouting | null = null;

  if (subsection) {
    const subsectionMatch = findSubsection(sections, subsection);

    if (subsectionMatch) {
      candidate = resolveSubsectionCandidate(
        subsectionMatch.sectionKey,
        subsectionMatch.subsectionKey,
        subsectionMatch.sectionConfig,
        subsectionMatch.subsectionConfig,
      );

      if (!candidate) {
        return {
          success: false,
          error: `Subsection ${subsectionMatch.subsectionKey} does not define playable audio in exam configuration.`,
        };
      }
    } else {
      const sectionKey = findSectionKey(sections, subsection);

      if (!sectionKey) {
        return {
          success: false,
          error: `Subsection ${subsection} is not configured in this exam.`,
        };
      }

      candidate = resolveSectionCandidate(sectionKey, sections[sectionKey]);
      if (!candidate) {
        return {
          success: false,
          error: `Section ${sectionKey} does not define playable audio in exam configuration.`,
        };
      }
    }
  } else {
    candidate = pickDefaultCandidate(sections, routing.defaultSection);
    if (!candidate) {
      return {
        success: false,
        error:
          'No playable audio configuration found. Provide subsection or update exam configuration.',
      };
    }
  }

  const selectedRecording = recordingNumber ?? candidate.recordings[0];

  if (!candidate.recordings.includes(selectedRecording)) {
    return {
      success: false,
      error: `Recording ${selectedRecording} is not configured for ${candidate.subsectionKey}. Allowed recordings: ${candidate.recordings.join(', ')}.`,
    };
  }

  const apiSectionSource =
    routing.routeScope === 'section'
      ? candidate.sectionKey
      : candidate.subsectionKey;

  return {
    success: true,
    sectionKey: candidate.sectionKey,
    subsectionKey: candidate.subsectionKey,
    apiSection: apiSectionSource.toLowerCase(),
    recordingNumber: selectedRecording,
    sourceType: candidate.sourceType,
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
        .optional()
        .describe(
          'Specific recording number to play. If not provided, the configured default for the location is used.',
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
        // If an exam subsection is provided while a configured exam is active, force exam mode
        // even when the model forgets to include isExamRecording=true.
        const examType = getExamTypeFromConfig(examConfig);
        const effectiveIsExamRecording =
          isExamRecording || (!!subsection && Boolean(examConfig?.id));

        // Prevent the model from presenting multiple exam recordings in a single request/turn.
        // This avoids skipping items and premature advancement.
        if (
          effectiveIsExamRecording &&
          requestState?.playAudioCalledThisRequest
        ) {
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
        if (effectiveIsExamRecording && requestState) {
          requestState.playAudioCalledThisRequest = true;
        }

        let finalSubsection = subsection;
        let finalRecordingNumber = recordingNumber;
        const playbackPolicy = resolvePlaybackPolicy({
          isExamRecording: effectiveIsExamRecording,
          examConfig,
        });

        let audioFile: string;
        let audioUrl: string;
        let sourceType: RoutingSourceType | 'fallback-random' =
          'fallback-random';
        let availableFilesCount = 0;

        if (effectiveIsExamRecording) {
          const routing = resolveExamAudioRouting({
            subsection,
            recordingNumber,
            examConfig,
          });

          if (!routing.success) {
            return {
              success: false,
              message: routing.error,
              error: 'invalid_exam_audio_mapping',
            };
          }

          finalSubsection = routing.subsectionKey;
          finalRecordingNumber = routing.recordingNumber;
          sourceType = routing.sourceType;

          audioUrl = `/api/audio?exam=${examType}&section=${routing.apiSection}&recording=${routing.recordingNumber}`;

          const templates = getConfiguredFileTemplates(examConfig);
          const fileTemplate =
            routing.sourceType === 'speaking-prompt'
              ? templates.speakingPrompt || templates.recording
              : templates.recording;

          if (fileTemplate) {
            audioFile = applyAudioFileTemplate({
              template: fileTemplate,
              examType,
              section: routing.apiSection,
              recording: routing.recordingNumber,
            });
          } else {
            const padded = routing.recordingNumber.toString().padStart(2, '0');
            audioFile = `${examType}-${routing.apiSection}-recording-${padded}.mp3`;
          }
        } else {
          // Dynamically get available audio files (fallback mode)
          const audioFiles = await getAvailableAudioFiles();

          if (audioFiles.length === 0) {
            console.warn('🎵 [PLAY AUDIO TOOL] No audio files available');
            return {
              success: false,
              message: 'No audio files available',
              error: 'No .mp3 files found in the audio directory',
            };
          }

          availableFilesCount = audioFiles.length;

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
            isExamRecording: effectiveIsExamRecording,
            allowSeek: playbackPolicy.allowSeek,
            allowPause: playbackPolicy.allowPause,
            maxReplays: playbackPolicy.maxReplays,
          },
        };

        // Send audio player data to the data stream
        dataStream.writeData(audioPlayerData);

        // Return success message with details for the AI
        const selectionMethod = finalRecordingNumber
          ? `configured recording #${finalRecordingNumber}`
          : `randomly selected from ${availableFilesCount} available files`;
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
            isExamRecording: effectiveIsExamRecording,
            url: audioUrl,
            availableFiles: availableFilesCount,
            selectionMethod,
            examType,
            sourceType,
            allowSeek: playbackPolicy.allowSeek,
            allowPause: playbackPolicy.allowPause,
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
