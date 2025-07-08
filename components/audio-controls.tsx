'use client';
import { Button } from './ui/button';
import { Mic, MicOff, Phone, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toggle } from '@/components/ui/toggle';
import MicFFT from '@/components/mic-fft';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// Extend the Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// TypeScript interfaces for Speech Recognition API
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
  start(): void;
  stop(): void;
}

interface AudioControlsProps {
  onTranscriptComplete?: (transcript: string) => void;
  onTranscriptUpdate?: (transcript: string) => void;
  onRecordingStart?: () => void;
}

export default function AudioControls({
  onTranscriptComplete,
  onTranscriptUpdate,
  onRecordingStart,
}: AudioControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micFft, setMicFft] = useState<number[]>([]);
  const [isRecognitionActive, setIsRecognitionActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const shouldRestartRecognition = useRef(false);
  const isConnectedRef = useRef(false);
  const transcriptRef = useRef('');

  // Initialize speech recognition once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition =
        window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition() as SpeechRecognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update interim transcript for real-time display
        setInterimTranscript(interimTranscript);

        setTranscript((prev) => {
          const newTranscript = prev + finalTranscript;
          transcriptRef.current = newTranscript; // Keep ref in sync

          // Stream the complete transcript (final + interim) to the input field
          const completeTranscript = newTranscript + interimTranscript;
          onTranscriptUpdate?.(completeTranscript);

          return newTranscript;
        });

        // Also call onTranscriptUpdate for interim-only updates
        if (finalTranscript === '' && interimTranscript !== '') {
          const completeTranscript = transcriptRef.current + interimTranscript;
          onTranscriptUpdate?.(completeTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecognitionActive(false);

        // Only show error toast for non-aborted errors
        if (event.error !== 'aborted') {
          toast.error('Speech recognition error: ' + event.error);
        }
      };

      recognition.onend = () => {
        setIsRecognitionActive(false);

        // Only restart if we should and we're still connected and not muted
        if (shouldRestartRecognition.current && isConnected && !isMuted) {
          try {
            recognition.start();
            setIsRecognitionActive(true);
          } catch (error) {
            console.error('Failed to restart recognition:', error);
          }
        }
      };

      recognition.onstart = () => {
        setIsRecognitionActive(true);
      };

      recognitionRef.current = recognition;
    } else {
      toast.error('Speech recognition is not supported in this browser');
    }

    return () => {
      shouldRestartRecognition.current = false;
      if (recognitionRef.current && isRecognitionActive) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('Error stopping recognition on cleanup:', error);
        }
      }
    };
  }, []); // Remove dependencies to prevent recreation

  // Audio visualization
  const updateMicFFT = () => {
    if (analyserRef.current && isConnectedRef.current && !isMuted) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Convert to values suitable for MicFFT component
      // MicFFT divides by 4, so we need to provide values that work well with that
      const fftValues = Array.from(dataArray.slice(0, 32)).map(
        (value) => value / 64, // Divide by 64 instead of 255 to get larger values
      );

      setMicFft(fftValues);

      animationFrameRef.current = requestAnimationFrame(updateMicFFT);
    } else {
      setMicFft([]);
    }
  };

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isRecognitionActive) {
      try {
        shouldRestartRecognition.current = true;
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  const stopSpeechRecognition = () => {
    shouldRestartRecognition.current = false;
    if (recognitionRef.current && isRecognitionActive) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone permission with less aggressive processing
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Disable to preserve more audio data
          noiseSuppression: false, // Disable to preserve more audio data
          autoGainControl: false, // Disable to preserve more audio data
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();

      // Resume AudioContext if it's suspended (required in modern browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Connect the audio graph
      source.connect(analyserRef.current);

      // IMPORTANT: Create a destination to ensure audio flows through the graph
      // Even though we don't want to hear it, we need to connect to destination
      // or use a GainNode with 0 gain to keep the audio graph active
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0; // Mute the output
      analyserRef.current.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Handle audio data if needed
        }
      };

      mediaRecorderRef.current.start();

      // Start speech recognition
      startSpeechRecognition();

      setIsRecording(true);
      setIsConnected(true);
      isConnectedRef.current = true; // Set ref immediately
      setTranscript(''); // Clear previous transcript
      setInterimTranscript(''); // Clear previous interim transcript
      transcriptRef.current = ''; // Clear ref as well

      // Notify parent component that recording started
      onRecordingStart?.();

      // Start audio visualization with a small delay to ensure stream is ready
      const startVisualization = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount,
          );
          analyserRef.current.getByteFrequencyData(dataArray);

          // Convert to values suitable for MicFFT component
          const fftValues = Array.from(dataArray.slice(0, 32)).map(
            (value) => value / 64,
          );

          setMicFft(fftValues);

          // Continue the animation loop
          animationFrameRef.current = requestAnimationFrame(updateMicFFT);
        }
      };

      // Add a small delay to ensure the audio stream is fully established
      setTimeout(startVisualization, 100);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(
        'Failed to start recording. Please check microphone permissions.',
      );
    }
  };

  const stopRecording = () => {
    // Stop speech recognition
    stopSpeechRecognition();

    // Stop media recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }

    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsRecording(false);
    setIsConnected(false);
    isConnectedRef.current = false; // Set ref immediately
    setIsMuted(false);
    setMicFft([]);
    setInterimTranscript(''); // Clear interim transcript

    // Send transcript to parent component if available
    if (transcriptRef.current.trim()) {
      onTranscriptComplete?.(transcriptRef.current.trim());
      toast.success('Message sent');
    } else {
      toast.info('No speech detected');
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      // Stop speech recognition when muted
      stopSpeechRecognition();
      // Stop audio visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setMicFft([]);
      toast.info('Microphone muted');
    } else {
      // Resume speech recognition when unmuted - add delay to ensure clean restart
      if (isConnectedRef.current) {
        setTimeout(() => {
          shouldRestartRecognition.current = true;
          startSpeechRecognition();
        }, 100);
      }
      // Resume audio visualization
      updateMicFFT();
      toast.success('Microphone unmuted');
    }
  };

  const discardRecording = () => {
    // Clear all transcript states
    setTranscript('');
    setInterimTranscript('');
    transcriptRef.current = '';

    // Restart speech recognition to ensure fresh session
    stopSpeechRecognition();
    if (!isMuted) {
      // Small delay to ensure clean restart
      setTimeout(() => {
        startSpeechRecognition();
      }, 100);
    }

    // Clear the parent's transcript update
    onTranscriptUpdate?.('');

    toast.success('Recording cleared - speak again');
  };

  const disconnect = () => {
    stopRecording();
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  if (!isRecording) {
    return (
      <div className="bottom-0 left-0 p-4 pb-6 flex items-center justify-center w-full">
        <Button
          className="flex items-center gap-1 rounded-full"
          type="button"
          onClick={startRecording}
        >
          <span>
            <Phone className="size-4 opacity-50 fill-current" strokeWidth={0} />
          </span>
          <span>Speak</span>
        </Button>
      </div>
    );
  }

  return (
    // <div className="fixed bottom-0 inset-x-0 flex flex-col items-center">
    <div className="bottom-0 left-0 p-4 flex flex-col items-center justify-center w-full">
      {/* Transcript Display */}
      <AnimatePresence>
        {isConnected && (transcript || interimTranscript) && (
          <motion.div
            initial={{
              y: 20,
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: 20,
              opacity: 0,
            }}
            className="max-w-2xl mx-auto px-4"
          >
            <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg p-4 shadow-lg">
              <div className="text-sm text-muted-foreground mb-2 text-center">
                Transcript:
              </div>
              <div className="text-sm leading-relaxed">
                {transcript && (
                  <span className="text-foreground">{transcript}</span>
                )}
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {interimTranscript}
                  </span>
                )}
                {!transcript && !interimTranscript && (
                  <span className="text-muted-foreground italic">
                    Listening...
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Controls */}
      <div
        className={cn(
          'bottom-0 left-0 p-4 pb-6 flex items-center justify-center w-full',
          'bg-gradient-to-t from-card via-card/90 to-card/0',
        )}
      >
        <AnimatePresence>
          {isConnected ? (
            <motion.div
              initial={{
                y: '100%',
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: '100%',
                opacity: 0,
              }}
              className={
                'p-4 bg-card border border-border/50 rounded-full flex items-center gap-4'
              }
            >
              <Toggle
                className={'rounded-full'}
                pressed={!isMuted}
                onPressedChange={toggleMute}
              >
                {isMuted ? (
                  <MicOff className={'size-4'} />
                ) : (
                  <Mic className={'size-4'} />
                )}
              </Toggle>

              <div className={'relative grid h-8 w-48 shrink grow-0'}>
                <MicFFT fft={micFft} className={'fill-current'} />
              </div>

              <Button
                className="flex items-center gap-1 rounded-full"
                onClick={discardRecording}
                type="button"
                variant={'outline'}
                title="Discard recording and start fresh"
              >
                <RotateCcw className="size-4" />
                <span>Reset</span>
              </Button>

              <Button
                className="flex items-center gap-1 rounded-full"
                onClick={disconnect}
                type="button"
                variant={'destructive'}
              >
                <span>
                  <Phone
                    className="size-4 opacity-50 fill-current"
                    strokeWidth={0}
                  />
                </span>
                <span>Stop</span>
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
