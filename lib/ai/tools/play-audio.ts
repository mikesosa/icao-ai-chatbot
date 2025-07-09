import { z } from 'zod';
import { tool } from 'ai';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from 'ai';

// Function to get available audio files
async function getAvailableAudioFiles(): Promise<string[]> {
  try {
    const audioDir = join(process.cwd(), 'app', '(chat)', 'api', 'audio');
    const files = await readdir(audioDir);
    
    // Filter for .mp3 files only
    const audioFiles = files.filter(file => 
      file.endsWith('.mp3') && !file.startsWith('.')
    );
    
    return audioFiles.length > 0 ? audioFiles : ['audio1.mp3', 'audio2.mp3', 'audio3.mp3', 'audio4.mp3', 'audio5.mp3', 'audio6.mp3'];
  } catch (error) {
    console.warn('Could not read audio directory, using fallback list:', error);
    // Fallback to known files if directory read fails
    return ['audio1.mp3', 'audio2.mp3', 'audio3.mp3', 'audio4.mp3', 'audio5.mp3', 'audio6.mp3'];
  }
}

export const playAudioTool = ({
  session,
  dataStream,
}: {
  session: Session;
  dataStream: DataStreamWriter;
}) =>
  tool({
    description: `Play audio files for exam listening comprehension exercises. 
    Automatically discovers and randomly selects from available .mp3 audio files in the system.
    Use this tool to present listening exercises during any exam that requires audio content.`,
    parameters: z.object({
      title: z.string().describe('Title for the audio exercise (e.g., "Recording 1 - Non-routine Situation", "Listening Part A")'),
      description: z.string().optional().describe('Optional description of what the audio contains or instructions'),
      subsection: z.string().optional().describe('Exam subsection identifier (e.g., "2A", "Part 1", "Listening Section")'),
    }),
    execute: async ({ title, description, subsection }) => {
      try {
        // Dynamically get available audio files
        const audioFiles = await getAvailableAudioFiles();
        
        if (audioFiles.length === 0) {
          return {
            success: false,
            message: 'No audio files available',
            error: 'No .mp3 files found in the audio directory',
          };
        }
        
        // Randomly select an audio file
        const audioFile = audioFiles[Math.floor(Math.random() * audioFiles.length)];
        
        // Create the audio URL that points to our audio serving endpoint
        const audioUrl = `/api/audio?file=${audioFile}`;
        
        // Send audio player data to the data stream
        dataStream.writeData({
          type: 'audio-player',
          content: {
            src: audioUrl,
            title,
            description: description || '',
            subsection: subsection || '',
            audioFile,
          },
        });

        // Return success message with details for the AI
        return {
          success: true,
          message: `Audio player created for ${audioFile} (randomly selected from ${audioFiles.length} available files)`,
          details: {
            audioFile,
            title,
            description,
            subsection,
            url: audioUrl,
            availableFiles: audioFiles.length,
          },
        };
      } catch (error) {
        console.error('Error creating audio player:', error);
        return {
          success: false,
          message: 'Failed to create audio player',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  }); 