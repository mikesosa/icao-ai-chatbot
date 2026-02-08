'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import type { Session } from 'next-auth';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';

import { DataStreamHandler } from '@/components/data-stream-handler';
import { VoiceSettings } from '@/components/voice-settings';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useExamContext } from '@/hooks/use-exam-context';
import { useSubscription } from '@/hooks/use-subscription';
import { useTextToSpeech } from '@/hooks/use-text-to-speech';
import { useTts } from '@/hooks/use-tts';
import { ChatSDKError } from '@/lib/errors';
import {
  fetchWithErrorHandlers,
  generateUUID,
  getModelType,
} from '@/lib/utils';

import type { CompleteExamConfig } from './exam-interface/exam';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import { Button } from './ui/button';

// ─── Speech Recognition types ───────────────────────────────────────────────
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// ─── Orb component ──────────────────────────────────────────────────────────
type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

function ExaminerOrb({ phase }: { phase: OrbPhase }) {
  const base = 'rounded-full transition-all duration-500 ease-in-out';
  const sizes: Record<OrbPhase, string> = {
    idle: 'size-28',
    listening: 'size-32',
    thinking: 'size-28',
    speaking: 'size-32',
  };
  const colors: Record<OrbPhase, string> = {
    idle: 'bg-muted-foreground/20',
    listening: 'bg-green-500/80',
    thinking: 'bg-muted-foreground/30',
    speaking: 'bg-primary/70',
  };
  const rings: Record<OrbPhase, string> = {
    idle: '',
    listening: 'ring-4 ring-green-400/30 animate-pulse',
    thinking: 'animate-pulse',
    speaking: 'ring-4 ring-primary/20 animate-pulse',
  };

  return (
    <div className="flex items-center justify-center py-6">
      <div
        className={`${base} ${sizes[phase]} ${colors[phase]} ${rings[phase]}`}
      />
    </div>
  );
}

// ─── Sentence-based subtitles ───────────────────────────────────────────────
// Splits text into sentences, maps each sentence to a character range,
// and shows one full sentence at a time based on audio progress —
// just like TV closed captions.

/** Split text into natural sentences. Handles ., !, ?, and : followed by space/end. */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string
  const raw = text.match(/[^.!?:]+[.!?:]+[\s]?|[^.!?:]+$/g);
  if (!raw) return [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

/** For each sentence, compute { start, end } as character offsets in the full text. */
function useSentenceOffsets(fullText: string, sentences: string[]) {
  return useMemo(() => {
    const totalChars = fullText.length;
    const offsets: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const sentence of sentences) {
      const idx = fullText.indexOf(sentence, cursor);
      const start = idx >= 0 ? idx : cursor;
      const end = start + sentence.length;
      offsets.push({ start, end });
      cursor = end;
    }
    return { offsets, totalChars };
  }, [fullText, sentences]);
}

function SubtitleTeleprompter({
  fullText,
  progress,
}: {
  fullText: string;
  progress: number; // 0-1
}) {
  const sentences = useMemo(() => splitSentences(fullText), [fullText]);
  const { offsets, totalChars } = useSentenceOffsets(fullText, sentences);

  // Character position the audio has reached
  const charPos = progress * totalChars;

  // Which sentence is currently being spoken?
  let activeSentenceIndex = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (charPos >= offsets[i].start) activeSentenceIndex = i;
  }

  const currentSentence = sentences[activeSentenceIndex] || '';

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={`s-${activeSentenceIndex}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="text-lg md:text-xl font-medium leading-relaxed text-foreground"
      >
        {currentSentence}
      </motion.p>
    </AnimatePresence>
  );
}

// ─── Status label ───────────────────────────────────────────────────────────
function statusLabel(phase: OrbPhase): string {
  switch (phase) {
    case 'idle':
      return 'Ready';
    case 'listening':
      return 'Listening...';
    case 'thinking':
      return 'One moment...';
    case 'speaking':
      return 'Examiner speaking';
  }
}

// ─── Progress bar ───────────────────────────────────────────────────────────
function ProgressHeader({
  examConfig,
  currentSection,
  currentSubsection,
  completedSections,
  totalSections,
}: {
  examConfig: CompleteExamConfig;
  currentSection: string | null;
  currentSubsection: string | null;
  completedSections: string[];
  totalSections: number;
}) {
  const sectionNum = currentSection ? Number.parseInt(currentSection) : 0;
  const sectionConfig = sectionNum
    ? examConfig.examConfig.sections[sectionNum]
    : null;
  const sectionName = sectionConfig?.name ?? '';
  const progress =
    totalSections > 0
      ? Math.round((completedSections.length / totalSections) * 100)
      : 0;

  return (
    <div className="space-y-1 text-center">
      <p className="text-xs text-muted-foreground">
        {currentSection
          ? `Section ${currentSection}${currentSubsection ? ` · ${currentSubsection}` : ''} — ${sectionName}`
          : 'Preparing...'}
      </p>
      <div className="mx-auto max-w-xs h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─── Transcript panel ───────────────────────────────────────────────────────
type TranscriptTurn = { speaker: 'EXAMINER' | 'YOU'; text: string };

function TranscriptPanel({
  turns,
  onClose,
}: {
  turns: TranscriptTurn[];
  onClose: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium">Transcript</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-7"
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {turns.map((turn, i) => (
          <div
            key={`turn-${turn.speaker}-${i}-${turn.text.slice(0, 20)}`}
            className="space-y-1"
          >
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {turn.speaker === 'EXAMINER' ? 'Examiner' : 'You'}
            </span>
            <p className="text-sm leading-relaxed">{turn.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Main ExamVoiceSession ──────────────────────────────────────────────────
interface ExamVoiceSessionProps {
  session: Session;
  id: string;
  examConfig: CompleteExamConfig;
  initialMessages: UIMessage[];
}

export function ExamVoiceSession({
  session: _session,
  id,
  examConfig,
  initialMessages,
}: ExamVoiceSessionProps) {
  const { mutate } = useSWRConfig();
  const {
    examType,
    examStarted,
    currentSection,
    currentSubsection,
    completedSections,
    endExam,
    setOnSectionChange,
  } = useExamContext();
  const { subscription: _subscription } = useSubscription();
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType: 'private',
  });
  const { enabled: ttsEnabled } = useTts();
  const {
    speak: speakTTS,
    stop: stopTTS,
    aiSpeaking,
    audioProgress,
  } = useTextToSpeech();

  const selectedChatModel = examType || '';

  // ── Chat hook (hidden, drives the AI) ──
  const {
    messages,
    setMessages,
    append,
    status,
    stop: stopChat,
    data,
    experimental_resume,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: fetchWithErrorHandlers,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel,
      selectedVisibilityType: visibilityType,
      modelType: getModelType(selectedChatModel),
      ...(examType && { currentSection, currentSubsection }),
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({ type: 'error', description: error.message });
      }
    },
  });

  useAutoResume({
    autoResume: true,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  // ── Data stream for exam control events ──
  const [dataStream, setDataStream] = useState<any[]>([]);
  useEffect(() => {
    if (data) setDataStream(data);
  }, [data]);

  // ── Local state ──
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [teleprompterText, setTeleprompterText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const hasStartedRef = useRef(false);
  const lastAutoTTSId = useRef<string | null>(null);
  // Track the first AI response (welcome/description) so we skip TTS for it
  const firstAssistantSeen = useRef(false);

  // ── Derived phase ──
  const phase: OrbPhase = useMemo(() => {
    if (aiSpeaking) return 'speaking';
    if (isRecording) return 'listening';
    if (status === 'streaming' || status === 'submitted') return 'thinking';
    return 'idle';
  }, [aiSpeaking, isRecording, status]);

  // ── Auto-start exam ──
  useEffect(() => {
    if (hasStartedRef.current || !examStarted || !examType) return;
    hasStartedRef.current = true;
    append({
      role: 'user',
      content: 'Start the evaluation. Begin with the first section.',
    });
  }, [examStarted, examType, append]);

  // ── Section change callback for admin jump ──
  useEffect(() => {
    if (examType && examStarted) {
      setOnSectionChange((section: string, subsection?: string) => {
        const msg = subsection
          ? `[Admin] I've jumped to Subsection ${subsection}. Please provide the specific instructions and content for this subsection.`
          : `[Admin] I've jumped to Section ${section}. Please provide the introduction and content for this section.`;
        append({ role: 'user', content: msg });
      });
      return () => setOnSectionChange(null);
    }
  }, [examType, examStarted, setOnSectionChange, append]);

  // ── Track assistant messages → transcript + auto-TTS ──
  useEffect(() => {
    if (status !== 'ready') return;

    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (last.id === lastAutoTTSId.current) return;

    const text = last.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim();
    if (!text) return;

    lastAutoTTSId.current = last.id;

    // The very first assistant message is the welcome/description — skip TTS for it
    if (!firstAssistantSeen.current) {
      firstAssistantSeen.current = true;
      setTeleprompterText(text);
      return;
    }

    setTeleprompterText(text);
    setTranscriptTurns((prev) => [...prev, { speaker: 'EXAMINER', text }]);

    if (ttsEnabled) {
      speakTTS(text, { messageId: last.id });
    }
  }, [status, messages, ttsEnabled, speakTTS]);

  // ── Speech Recognition helpers ──
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setInterimText('');
  }, []);

  const startListening = useCallback(() => {
    if (isRecording || aiSpeaking || isPaused) return;

    const Ctor =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null;
    if (!Ctor) {
      toast({
        type: 'error',
        description: 'Speech recognition not supported.',
      });
      return;
    }

    transcriptRef.current = '';
    setInterimText('');

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalText += `${t} `;
        else interim += t;
      }
      if (finalText) transcriptRef.current += finalText;
      setInterimText(interim);
    };
    recognition.onerror = () => {
      stopListening();
    };
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [isRecording, aiSpeaking, isPaused, stopListening]);

  // ── Push-to-talk handlers ──
  const pressingRef = useRef(false);

  const onPTTStart = useCallback(() => {
    if (pressingRef.current) return;
    pressingRef.current = true;
    startListening();
  }, [startListening]);

  const onPTTEnd = useCallback(() => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    stopListening();

    // Submit after a tiny delay so final transcript settles
    setTimeout(() => {
      const text = transcriptRef.current.trim();
      if (!text) return;
      setTranscriptTurns((prev) => [...prev, { speaker: 'YOU', text }]);
      append({ role: 'user', content: text });
    }, 300);
  }, [stopListening, append]);

  // ── Repeat last examiner message ──
  const handleRepeat = useCallback(() => {
    const lastExaminer = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastExaminer) return;
    const text = lastExaminer.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim();
    if (text) speakTTS(text, { messageId: lastExaminer.id });
  }, [messages, speakTTS]);

  // ── Pause / Resume ──
  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      stopTTS();
      stopListening();
      setIsPaused(true);
    }
  }, [isPaused, stopTTS, stopListening]);

  // ── End exam ──
  const handleEndExam = useCallback(() => {
    stopTTS();
    stopListening();
    stopChat();

    // Ask for report
    append({
      role: 'user',
      content:
        'I want to finish the exam now. Please provide the final evaluation based on my performance.',
    });
    endExam();
  }, [stopTTS, stopListening, stopChat, append, endExam]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      stopListening();
      stopTTS();
    };
  }, [stopListening, stopTTS]);

  const totalSections = examConfig.controlsConfig.totalSections;

  // ── Render ──
  return (
    <div className="flex h-dvh bg-background">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Header ─── */}
        <header className="flex items-center gap-3 px-4 py-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleEndExam}
            title="Exit exam"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div className="flex-1 text-center">
            <p className="text-sm font-medium">{examConfig.name}</p>
            <ProgressHeader
              examConfig={examConfig}
              currentSection={currentSection}
              currentSubsection={currentSubsection}
              completedSections={completedSections}
              totalSections={totalSections}
            />
          </div>

          <VoiceSettings />
        </header>

        {/* ─── Body ─── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
          {/* Pause overlay */}
          <AnimatePresence>
            {isPaused && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center"
              >
                <div className="text-center space-y-4">
                  <p className="text-xl font-medium">Exam Paused</p>
                  <Button onClick={togglePause} size="lg">
                    <Play className="size-4 mr-2" /> Resume
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Orb */}
          <ExaminerOrb phase={phase} />

          {/* Status */}
          <p className="text-sm text-muted-foreground mb-2">
            {statusLabel(phase)}
          </p>

          {/* Subtitles — sentence by sentence, like TV captions */}
          <div className="text-center max-w-lg mb-6 min-h-16 flex items-center justify-center px-4">
            {aiSpeaking && teleprompterText ? (
              <SubtitleTeleprompter
                fullText={teleprompterText}
                progress={audioProgress}
              />
            ) : (
              <p className="text-sm text-foreground/60">
                {phase === 'idle' && !aiSpeaking && !teleprompterText
                  ? examConfig.messagesConfig.welcomeMessage.split('\n')[0] ||
                    'Welcome.'
                  : ''}
              </p>
            )}
          </div>

          {/* Interim transcript while recording */}
          <AnimatePresence>
            {isRecording && (interimText || transcriptRef.current) && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="text-xs text-muted-foreground italic text-center mb-4 max-w-sm"
              >
                {transcriptRef.current}
                {interimText && (
                  <span className="text-muted-foreground/60">
                    {interimText}
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          {/* ─── Push-to-Talk button ─── */}
          <Button
            size="lg"
            className={`rounded-full px-8 py-6 text-base ${isRecording ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onMouseDown={onPTTStart}
            onMouseUp={onPTTEnd}
            onMouseLeave={onPTTEnd}
            onTouchStart={onPTTStart}
            onTouchEnd={onPTTEnd}
            onTouchCancel={onPTTEnd}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onPTTStart();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onPTTEnd();
              }
            }}
            disabled={
              aiSpeaking ||
              isPaused ||
              status === 'streaming' ||
              status === 'submitted'
            }
          >
            <Mic className="size-5 mr-2" />
            {isRecording ? 'Release to Send' : 'Push to Talk'}
          </Button>
        </div>

        {/* ─── Bottom toolbar ─── */}
        <div className="flex items-center justify-center gap-6 px-4 py-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRepeat}
            disabled={aiSpeaking || isPaused}
            title="Repeat last instruction"
          >
            <RotateCcw className="size-4 mr-1.5" />
            Repeat
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={togglePause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <>
                <Play className="size-4 mr-1.5" /> Resume
              </>
            ) : (
              <>
                <Pause className="size-4 mr-1.5" /> Pause
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            title="Toggle transcript"
          >
            {showTranscript ? (
              <PanelRightClose className="size-4 mr-1.5" />
            ) : (
              <PanelRightOpen className="size-4 mr-1.5" />
            )}
            Transcript
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleEndExam}
            title="End exam"
          >
            <Square className="size-4 mr-1.5" />
            End
          </Button>
        </div>
      </div>

      {/* ─── Transcript side panel ─── */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <TranscriptPanel
              turns={transcriptTurns}
              onClose={() => setShowTranscript(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden data stream handler for exam control events */}
      <DataStreamHandler id={id} dataStream={dataStream} />
    </div>
  );
}
