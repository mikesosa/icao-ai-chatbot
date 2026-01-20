import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

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

export const playAudioTool = ({
  session: _session,
  dataStream,
  examConfig,
}: {
  session: Session;
  dataStream: DataStreamWriter;
  examConfig?: any;
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
        let examType = 'tea'; // Default fallback
        if (examConfig?.id) {
          // Extract exam type from ID (e.g., 'tea-evaluator' -> 'tea', 'elpac-evaluator' -> 'elpac')
          examType = examConfig.id.replace('-evaluator', '');
          console.log('🎵 [PLAY AUDIO TOOL] Detected exam type:', examType);
        } else {
          console.warn(
            '🎵 [PLAY AUDIO TOOL] No exam config found, using default exam type:',
            examType,
          );
        }

        // Select audio file based on recordingNumber or randomly
        let audioFile: string;
        if (recordingNumber && isExamRecording && subsection) {
          // For exam recordings with specific number, construct the filename
          const examSection = subsection.toLowerCase();
          const padded = recordingNumber.toString().padStart(2, '0');

          // Use real filenames for ELPAC (Paper 1 listening, Paper 2 oral prompts)
          if (examType === 'elpac') {
            if (examSection === '1') {
              audioFile = `elpac-1-listening-${padded}.mp3`;
            } else if (examSection === '2') {
              audioFile = `elpac-2-speaking-prompt-${padded}.mp3`;
            } else {
              audioFile = `${examSection}-recording-${padded}.mp3`;
            }
          } else {
            audioFile = `${examSection}-recording-${padded}.mp3`;
          }
          console.log(
            '🎵 [PLAY AUDIO TOOL] Using specific recording:',
            audioFile,
          );
        } else {
          // Randomly select an audio file (original behavior)
          audioFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
          console.log(
            '🎵 [PLAY AUDIO TOOL] Randomly selected audio file:',
            audioFile,
          );
        }

        // Create the audio URL that points to our audio serving endpoint
        let audioUrl: string;
        if (isExamRecording && subsection) {
          // For exam recordings, use the exam-specific format with dynamic exam type
          // Convert subsection like "2A" to section format like "2a"
          const examSection = subsection.toLowerCase();
          const recording = recordingNumber || 1; // Use specific recording or default to 1

          // Handle ELPAC oral interaction prompts (Paper 2 / Section 2)
          if (examType === 'elpac' && examSection === '2') {
            audioUrl = `/api/audio?exam=${examType}&section=${examSection}&prompt=${recording}`;
          } else {
            audioUrl = `/api/audio?exam=${examType}&section=${examSection}&recording=${recording}`;
          }
          console.log(
            '🎵 [PLAY AUDIO TOOL] Generated exam audio URL:',
            audioUrl,
          );
        } else {
          // For general audio, use the file-based format
          audioUrl = `/api/audio?file=${audioFile}`;
          console.log(
            '🎵 [PLAY AUDIO TOOL] Generated general audio URL:',
            audioUrl,
          );
        }

        // Generate recording ID if not provided
        const finalRecordingId =
          recordingId ||
          `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(
          '🎵 [PLAY AUDIO TOOL] Final recording ID:',
          finalRecordingId,
        );

        // Prepare audio player data
        const audioPlayerData = {
          type: 'audio-player',
          content: {
            src: audioUrl,
            title,
            description: description || '',
            subsection: subsection || '',
            audioFile,
            recordingId: finalRecordingId,
            isExamRecording,
          },
        };
        console.log(
          '🎵 [PLAY AUDIO TOOL] Audio player data to send:',
          audioPlayerData,
        );

        // Send audio player data to the data stream
        dataStream.writeData(audioPlayerData);

        // Return success message with details for the AI
        const selectionMethod = recordingNumber
          ? `specific recording #${recordingNumber}`
          : `randomly selected from ${audioFiles.length} available files`;
        const result = {
          success: true,
          message: `Audio player created for ${audioFile} (${selectionMethod})`,
          details: {
            audioFile,
            title,
            description,
            subsection,
            recordingNumber,
            recordingId: finalRecordingId,
            isExamRecording,
            url: audioUrl,
            availableFiles: audioFiles.length,
            selectionMethod,
            examType, // Include exam type in details
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
