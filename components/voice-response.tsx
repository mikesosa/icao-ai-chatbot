'use client';

import { useTextToSpeech, type VoiceLanguage } from '@/hooks/use-voice';
import { Button } from './ui/button';
import { VolumeIcon, VolumeOffIcon } from './icons';
import { useEffect, useState } from 'react';

interface VoiceResponseProps {
  text: string;
  autoPlay?: boolean;
  language?: VoiceLanguage;
  className?: string;
}

export function VoiceResponse({
  text,
  autoPlay = false,
  language = 'es-ES',
  className = '',
}: VoiceResponseProps) {
  const [mounted, setMounted] = useState(false);
  const { speak, stopSpeaking, isSpeaking, isSupported } = useTextToSpeech({
    rate: 0.8, // Slower for ICAO exam comprehension
    pitch: 1,
    volume: 1,
  });

  // Ensure component is mounted on client before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      speak(text, language);
    }
  };

  // Auto-play functionality for ICAO exam simulation
  useEffect(() => {
    if (autoPlay && text && isSupported && text.trim().length > 0) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        speak(text, language);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, isSupported, speak, language]);

  // Don't render if not mounted or not supported
  if (!mounted || !isSupported) return null;

  return (
    <Button
      onClick={handleSpeak}
      variant="ghost"
      size="sm"
      className={`size-6 p-0 opacity-70 hover:opacity-100 transition-opacity ${className}`}
      title={isSpeaking ? 'Stop speaking' : 'Read message aloud'}
      disabled={!text || text.trim().length === 0}
    >
      {isSpeaking ? <VolumeOffIcon size={14} /> : <VolumeIcon size={14} />}
    </Button>
  );
}

// Specialized component for ICAO exam mode
export function ICAOVoiceResponse({
  text,
  autoPlay = false,
  language = 'es-ES',
}: Omit<VoiceResponseProps, 'className'>) {
  const [mounted, setMounted] = useState(false);
  const { speak, stopSpeaking, isSpeaking, isSupported } = useTextToSpeech({
    rate: 0.7, // Even slower for exam mode
    pitch: 1.1, // Slightly higher pitch for clarity
    volume: 1,
  });

  // Ensure component is mounted on client before rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      // Clean up text for ICAO exam format
      const cleanText = text
        .replace(/\b[A-Z]{2,}\b/g, (match) => match.split('').join('. ') + '.') // Spell out acronyms
        .replace(/\b\d+\b/g, (match) => match.split('').join(' ')) // Spell out numbers
        .replace(/[^\w\s.,!?;:-]/g, ' ') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      speak(cleanText, language);
    }
  };

  // Auto-play for exam questions
  useEffect(() => {
    if (autoPlay && text && isSupported && text.trim().length > 0) {
      const timer = setTimeout(() => {
        handleSpeak();
      }, 1000); // Longer delay for exam mode

      return () => clearTimeout(timer);
    }
  }, [text, autoPlay, isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !isSupported) return null;

  return (
    <Button
      onClick={handleSpeak}
      variant="ghost"
      size="sm"
      className="size-8 p-0 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      title={isSpeaking ? 'Stop exam audio' : 'Play exam question audio'}
      disabled={!text || text.trim().length === 0}
    >
      {isSpeaking ? <VolumeOffIcon size={16} /> : <VolumeIcon size={16} />}
    </Button>
  );
}
