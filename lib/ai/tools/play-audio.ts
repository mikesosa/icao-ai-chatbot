import { z } from 'zod';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import type { DataStreamWriter } from 'ai';

export const playAudioTool = ({
  session,
  dataStream,
}: {
  session: Session;
  dataStream: DataStreamWriter;
}) =>
  tool({
    description: `Play audio files for exam listening comprehension exercises. 
    Available audio files: audio1.mp3, audio2.mp3, audio3.mp3, audio4.mp3, audio5.mp3, audio6.mp3.
    Use this tool to present listening exercises during any exam that requires audio content.`,
    parameters: z.object({
      audioFile: z.enum(['audio1.mp3', 'audio2.mp3', 'audio3.mp3', 'audio4.mp3', 'audio5.mp3', 'audio6.mp3'])
        .describe('The audio file to play from the available exam audio files'),
      title: z.string().describe('Title for the audio exercise (e.g., "Recording 1 - Non-routine Situation", "Listening Part A")'),
      description: z.string().optional().describe('Optional description of what the audio contains or instructions'),
      subsection: z.string().optional().describe('Exam subsection identifier (e.g., "2A", "Part 1", "Listening Section")'),
    }),
    execute: async ({ audioFile, title, description, subsection }) => {
      try {
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
          message: `Audio player created for ${audioFile}`,
          details: {
            audioFile,
            title,
            description,
            subsection,
            url: audioUrl,
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