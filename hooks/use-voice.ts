'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// Language configurations for ICAO exam support
export const VOICE_LANGUAGES = {
  'es-ES': { name: 'Español', code: 'es-ES' },
  'en-US': { name: 'English', code: 'en-US' },
  'fr-FR': { name: 'Français', code: 'fr-FR' },
} as const;

export type VoiceLanguage = keyof typeof VOICE_LANGUAGES;

interface VoiceRecorderOptions {
  onTranscription: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  language?: VoiceLanguage;
  continuous?: boolean;
  interimResults?: boolean;
}

export function useVoiceRecorder({
  onTranscription,
  onSpeechStart,
  onSpeechEnd,
  language = 'es-ES',
  continuous = false,
  interimResults = false,
}: VoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check browser support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(supported);
    
    console.log('Voice support check:', {
      webkitSpeechRecognition: 'webkitSpeechRecognition' in window,
      SpeechRecognition: 'SpeechRecognition' in window,
      supported,
      userAgent: navigator.userAgent
    });
    
    if (!supported) {
      console.warn('Speech recognition not supported in this browser');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!isSupported || typeof window === 'undefined') {
      const errorMsg = 'Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setError(null);
        onSpeechStart?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.resultIndex][0].transcript;
        onTranscription(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMsg = `Voice recognition error: ${event.error}`;
        console.error('Speech recognition error:', event.error);
        setError(errorMsg);
        setIsRecording(false);
        
        // Provide user-friendly error messages
        switch (event.error) {
          case 'no-speech':
            toast.error('No speech detected. Please try again.');
            break;
          case 'audio-capture':
            toast.error('Microphone access denied. Please check permissions.');
            break;
          case 'not-allowed':
            toast.error('Microphone permission denied. Please allow microphone access.');
            break;
          case 'network':
            toast.error('Network error. Please check your connection.');
            break;
          default:
            toast.error(errorMsg);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        onSpeechEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const errorMsg = 'Failed to start speech recognition';
      console.error(errorMsg, err);
      setError(errorMsg);
      toast.error(errorMsg);
      setIsRecording(false);
    }
  }, [isSupported, language, continuous, interimResults, onTranscription, onSpeechStart, onSpeechEnd]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    isSupported,
    error,
    startRecording,
    stopRecording,
  };
}

interface TextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useTextToSpeech(options: TextToSpeechOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const { rate = 0.9, pitch = 1, volume = 1 } = options;

  // Check browser support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const supported = 'speechSynthesis' in window;
    setIsSupported(supported);
  }, []);

  // Load available voices
  useEffect(() => {
    if (!isSupported || typeof window === 'undefined') return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  const speak = useCallback((text: string, language: VoiceLanguage = 'es-ES') => {
    if (!isSupported || typeof window === 'undefined') {
      toast.error('Text-to-speech not supported in this browser');
      return;
    }

    if (!text.trim()) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find the best voice for the language
    const preferredVoice = voices.find(voice => 
      voice.lang.toLowerCase().startsWith(language.toLowerCase())
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
      toast.error('Failed to speak text');
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error starting speech synthesis:', error);
      setIsSpeaking(false);
      toast.error('Failed to start text-to-speech');
    }
  }, [isSupported, voices, rate, pitch, volume]);

  const stopSpeaking = useCallback(() => {
    if (isSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported && isSpeaking && typeof window !== 'undefined') {
      window.speechSynthesis.pause();
    }
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (isSupported && typeof window !== 'undefined') {
      window.speechSynthesis.resume();
    }
  }, [isSupported]);

  return {
    speak,
    stopSpeaking,
    pause,
    resume,
    isSpeaking,
    isSupported,
    voices,
  };
}

// Hook for ICAO exam mode with specialized settings
export function useICAOVoice() {
  const [language, setLanguage] = useState<VoiceLanguage>('es-ES');
  const [autoRead, setAutoRead] = useState(false);
  
  const tts = useTextToSpeech({
    rate: 0.8, // Slower rate for better comprehension in exams
    pitch: 1,
    volume: 1,
  });

  const stt = useVoiceRecorder({
    onTranscription: () => {}, // Will be overridden when used
    language,
    continuous: false,
    interimResults: false,
  });

  const speakICAOText = useCallback((text: string) => {
    // Clean up text for better speech synthesis
    const cleanText = text
      .replace(/\b[A-Z]{2,}\b/g, (match) => match.split('').join(' ')) // Spell out acronyms
      .replace(/\d+/g, (match) => match.split('').join(' ')) // Spell out numbers
      .replace(/[^\w\s.,!?;]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    tts.speak(cleanText, language);
  }, [tts, language]);

  return {
    ...tts,
    ...stt,
    language,
    setLanguage,
    autoRead,
    setAutoRead,
    speakICAOText,
    availableLanguages: VOICE_LANGUAGES,
  };
} 