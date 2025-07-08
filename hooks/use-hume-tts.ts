'use client';

import { useState, useEffect, useRef } from 'react';
import { HumeClient } from 'hume';

interface UseHumeTTSProps {
  apiKey?: string;
  voice?: string;
}

export function useHumeTTS({ apiKey, voice }: UseHumeTTSProps = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const humeClientRef = useRef<HumeClient | null>(null);

  useEffect(() => {
    if (apiKey) {
      humeClientRef.current = new HumeClient({
        apiKey: apiKey,
      });
    }
  }, [apiKey]);

  const playText = async (text: string) => {
    if (!humeClientRef.current) {
      setError('Hume client not initialized. Please provide an API key.');
      return;
    }

    if (!text.trim()) {
      setError('No text provided to play.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the correct API structure based on the TypeScript definitions
      const response = await humeClientRef.current.tts.synthesizeJson({
        body: {
          utterances: [
            {
              text: text,
              description: voice || undefined, // Use voice as description for voice characteristics
            },
          ],
          format: {
            type: 'mp3',
          },
          numGenerations: 1,
        },
      });

      // Check if the response has the expected structure
      if (response.generations && response.generations.length > 0) {
        const generation = response.generations[0];
        // The audio data is directly available on the generation object
        const audioData = generation.audio;
        
        // Convert base64 audio data to blob
        const audioBytes = atob(audioData);
        const audioArray = new Uint8Array(audioBytes.length);
        for (let i = 0; i < audioBytes.length; i++) {
          audioArray[i] = audioBytes.charCodeAt(i);
        }
        const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create and play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.addEventListener('loadstart', () => setIsLoading(false));
        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        });
        audio.addEventListener('error', () => {
          setError('Failed to play audio');
          setIsPlaying(false);
          setIsLoading(false);
        });

        await audio.play();
      } else {
        throw new Error('No generations found in response');
      }
    } catch (err) {
      console.error('Error generating TTS audio:', err);
      setError('Failed to generate audio: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setIsLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return {
    playText,
    stopAudio,
    isPlaying,
    isLoading,
    error,
  };
} 