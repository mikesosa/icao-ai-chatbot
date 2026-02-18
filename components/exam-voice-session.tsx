'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
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

import { AudioPlayer } from '@/components/audio-player';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ImageDisplay } from '@/components/image-display';
import { VoiceSettings } from '@/components/voice-settings';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useExamContext } from '@/hooks/use-exam-context';
import { useStreamingTTS } from '@/hooks/use-streaming-tts';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';

// ─── Sentence extraction helper ──────────────────────────────────────────────
// Smarter than a simple regex split: avoids breaking on numbered lists ("2."),
// single-letter abbreviations ("A."), and common abbreviations ("Dr.", "e.g.").
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'capt',
  'sgt',
  'lt',
  'col',
  'gen',
  'dept',
  'approx',
  'incl',
  'no',
  'vol',
  'ref',
  'fig',
  'sec',
]);
const AUTO_CLOSE_SECONDS = 5;
const EXAM_START_TRIGGER_MESSAGE =
  'Start the evaluation. Begin with the first section.';
const EXAM_FINISH_TRIGGER_MESSAGE =
  '[System] The candidate has ended the exam. Immediately call examSectionControl(action: "complete_exam", reason: "candidate requested completion"), then provide the final evaluation and clearly confirm the exam is complete.';

function extractSentences(text: string): {
  sentences: string[];
  consumed: number;
} {
  const sentences: string[] = [];
  let consumed = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nextCh = text[i + 1];

    // Only consider it a boundary when punctuation is followed by a space
    // (meaning more text came after, so the sentence is complete)
    if ((ch === '.' || ch === '!' || ch === '?') && nextCh === ' ') {
      const segment = text.slice(consumed, i + 1).trim();
      if (!segment) continue;

      // Skip numbered list items: the segment is just a number + dot, e.g. "2."
      if (ch === '.' && /^\d+\.$/.test(segment)) continue;

      // Skip if the final word is a single uppercase letter + dot (initial)
      const words = segment.split(/\s+/);
      const lastWord = (words[words.length - 1] || '').replace(/\.$/, '');
      if (ch === '.' && /^[A-Z]$/.test(lastWord)) continue;

      // Skip common abbreviations (case-insensitive)
      if (ch === '.' && ABBREVIATIONS.has(lastWord.toLowerCase())) continue;

      sentences.push(segment);
      consumed = i + 2; // skip past the space
    }
  }

  return { sentences, consumed };
}

function getAssistantVoiceText(message: UIMessage | null | undefined): string {
  if (!message?.parts) return '';

  const rawText = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();

  let examAudioInstruction: string | null = null;
  let examImageInstruction: string | null = null;

  for (const part of message.parts) {
    if (
      part.type !== 'tool-invocation' ||
      part.toolInvocation?.state !== 'result'
    ) {
      continue;
    }

    const invocation = part.toolInvocation;
    const result = invocation.result as any;
    const details = result?.details;

    if (invocation.toolName === 'playAudio' && details?.isExamRecording) {
      const description =
        typeof details.description === 'string'
          ? details.description.trim()
          : '';
      examAudioInstruction = description || 'Press Play to listen.';
      continue;
    }

    if (invocation.toolName === 'displayImage' && details?.isExamImage) {
      const description =
        typeof details.description === 'string'
          ? details.description.trim()
          : '';

      if (details.subsection === '2II') {
        const isGenericExamDescription =
          description.length === 0 ||
          /visual stimulus|operational communication scenario|image set/i.test(
            description,
          );

        examImageInstruction = description
          ? isGenericExamDescription
            ? 'Task One is complete. We are now moving to Task Two. Now I will show you an operational image. Please describe what you see.'
            : `Task One is complete. We are now moving to Task Two. ${description}`
          : 'Task One is complete. We are now moving to Task Two. Now I will show you an operational image. Please describe what you see.';
      } else {
        examImageInstruction =
          description || 'Please review the image and continue the task.';
      }
    }
  }

  if (examAudioInstruction) {
    if (!rawText) return examAudioInstruction;

    const normalizedRawText = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedInstruction = examAudioInstruction
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (
      normalizedRawText === normalizedInstruction ||
      normalizedRawText === 'press play to listen.' ||
      normalizedRawText === 'press play to listen'
    ) {
      return rawText;
    }

    // Runtime guard: keep audio turns as instruction-only for realistic exam flow.
    return examAudioInstruction;
  }

  if (examImageInstruction) {
    if (!rawText) return examImageInstruction;

    const normalizedRawText = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedInstruction = examImageInstruction
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (normalizedRawText === normalizedInstruction) {
      return rawText;
    }

    // For image-tool turns, ensure a clear spoken transition exists.
    return examImageInstruction;
  }

  return rawText;
}

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
type ExamCompletionPhase = 'active' | 'evaluating' | 'delivering' | 'complete';
type ExamAudioCard = {
  src: string;
  title: string;
  description?: string;
  recordingId?: string;
  isExamRecording: boolean;
  subsection?: string;
  audioFile?: string;
  maxReplays?: number;
  allowSeek?: boolean;
};
type ExamImageCard = {
  title: string;
  description?: string;
  images: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  imageSetId?: string;
  isExamImage: boolean;
  subsection?: string;
  layout?: 'single' | 'side-by-side' | 'stacked';
  instructions?: string[];
};

function TranscriptPanel({
  turns,
  onClose,
  onCopyDebugLog,
  isCopyingDebugLog = false,
}: {
  turns: TranscriptTurn[];
  onClose: () => void;
  onCopyDebugLog?: () => void;
  isCopyingDebugLog?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  return (
    <div
      className="w-80 border-l bg-background flex flex-col h-full"
      data-testid="exam-transcript-panel"
    >
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium">Transcript</span>
        <div className="flex items-center gap-1">
          {onCopyDebugLog && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyDebugLog}
              disabled={isCopyingDebugLog}
              data-testid="exam-debug-copy"
            >
              <Copy className="size-3.5 mr-1.5" />
              {isCopyingDebugLog ? 'Copying...' : 'Copy Logs'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-7"
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {turns.map((turn, i) => (
          <div
            key={`turn-${turn.speaker}-${i}-${turn.text.slice(0, 20)}`}
            className="space-y-1"
            data-testid={`exam-transcript-turn-${i}`}
          >
            <span
              className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
              data-testid={`exam-transcript-speaker-${i}`}
            >
              {turn.speaker === 'EXAMINER' ? 'Examiner' : 'You'}
            </span>
            <p
              className="text-sm leading-relaxed"
              data-testid={`exam-transcript-text-${i}`}
            >
              {turn.text}
            </p>
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
    examStartTime,
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
  // Single-shot TTS (used for Repeat button)
  const {
    speak: speakTTSSingle,
    stop: stopTTSSingle,
    ttsLoading: ttsLoadingSingle,
    aiSpeaking: aiSpeakingSingle,
  } = useTextToSpeech();
  // Streaming TTS (used for live sentence-by-sentence playback)
  const {
    enqueue: enqueueSentence,
    stop: stopStreamingTTS,
    reset: resetStreamingTTS,
    aiSpeaking: aiSpeakingStream,
    ttsLoading: ttsLoadingStream,
    currentSentence,
  } = useStreamingTTS();

  const aiSpeaking = aiSpeakingSingle || aiSpeakingStream;
  const ttsLoading = ttsLoadingSingle || ttsLoadingStream;

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
  const [isCopyingDebugLog, setIsCopyingDebugLog] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState('');
  const [userCaptionText, setUserCaptionText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExamAudioPlaying, setIsExamAudioPlaying] = useState(false);
  const [completedExamAudioIds, setCompletedExamAudioIds] = useState<string[]>(
    [],
  );
  const [pinnedAudioPlayer, setPinnedAudioPlayer] =
    useState<ExamAudioCard | null>(null);
  const [audioPlayerReadyToShow, setAudioPlayerReadyToShow] = useState(false);
  const [pinnedImageDisplay, setPinnedImageDisplay] =
    useState<ExamImageCard | null>(null);
  const [imageDisplayReadyToShow, setImageDisplayReadyToShow] = useState(false);
  const [suppressImageUntilNextAssistant, setSuppressImageUntilNextAssistant] =
    useState(false);
  const [dismissedImageSetIds, setDismissedImageSetIds] = useState<string[]>(
    [],
  );
  const [examCompletionPhase, setExamCompletionPhase] =
    useState<ExamCompletionPhase>('active');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] =
    useState(AUTO_CLOSE_SECONDS);
  const handledAudioCompletionRef = useRef<Set<string>>(new Set());
  const hasAutoClosedRef = useRef(false);
  const lastProcessedCompletionEventIndexRef = useRef(-1);
  const completionRequestRef = useRef<{
    assistantCountAtRequest: number;
    watchdogRetrySent: boolean;
  } | null>(null);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef(''); // mirror of interimText for use in callbacks
  const isRecordingRef = useRef(false); // mirror for global key handler
  const hasStartedRef = useRef(false);
  const examStartMarkerKeyRef = useRef<string | null>(null);
  const subsectionRecoverySentRef = useRef<Set<string>>(new Set());
  const lastAutoTTSId = useRef<string | null>(null);
  // Track the first AI response (welcome/description) so we skip TTS for it
  const firstAssistantSeen = useRef(false);

  // ── Extract audio player from latest assistant message ──
  const currentAudioPlayer = useMemo((): ExamAudioCard | null => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastAssistant?.parts) return null;

    // Find playAudio tool result (state === 'result')
    for (const part of lastAssistant.parts) {
      if (
        part.type === 'tool-invocation' &&
        part.toolInvocation?.toolName === 'playAudio' &&
        part.toolInvocation?.state === 'result'
      ) {
        const result = part.toolInvocation.result as any;
        const details = result?.details;
        if (details?.url) {
          return {
            src: details.url,
            title: details.title || 'Audio Recording',
            description: details.description,
            recordingId: details.recordingId,
            isExamRecording: details.isExamRecording || false,
            subsection: details.subsection,
            audioFile: details.audioFile,
            maxReplays: details.maxReplays,
            allowSeek: details.allowSeek,
          };
        }
      }
    }
    return null;
  }, [messages]);

  const currentImageDisplay = useMemo((): ExamImageCard | null => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastAssistant?.parts) return null;

    for (const part of lastAssistant.parts) {
      if (
        part.type === 'tool-invocation' &&
        part.toolInvocation?.toolName === 'displayImage' &&
        part.toolInvocation?.state === 'result'
      ) {
        const result = part.toolInvocation.result as any;
        const details = result?.details;
        if (Array.isArray(details?.images) && details.images.length > 0) {
          return {
            title: details.title || 'Image Display',
            description: details.description,
            images: details.images,
            imageSetId: details.imageSetId,
            isExamImage: details.isExamImage || false,
            subsection: details.subsection,
            layout: details.layout || 'single',
            instructions: details.instructions || [],
          };
        }
      }
    }
    return null;
  }, [messages]);

  const latestAssistantMessageId = useMemo(() => {
    return (
      [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null
    );
  }, [messages]);

  const assistantMessages = useMemo(
    () => messages.filter((message) => message.role === 'assistant'),
    [messages],
  );

  const hasExamRunStarted = useMemo(
    () =>
      messages.some((message) => {
        if (message.role !== 'user') return false;
        if (typeof message.content !== 'string') return false;
        return (
          message.content === EXAM_START_TRIGGER_MESSAGE ||
          message.content.startsWith('[Admin]')
        );
      }),
    [messages],
  );

  const hasMediaForCurrentSubsection = useMemo(() => {
    if (!currentSubsection) return false;

    return messages.some((message) => {
      if (message.role !== 'assistant' || !message.parts) return false;

      return message.parts.some((part) => {
        if (part.type !== 'tool-invocation') return false;
        const invocation = part.toolInvocation;
        if (invocation?.state !== 'result') return false;
        if (
          invocation.toolName !== 'playAudio' &&
          invocation.toolName !== 'displayImage'
        ) {
          return false;
        }

        const result = invocation.result as any;
        const subsection = result?.details?.subsection;
        return subsection === currentSubsection;
      });
    });
  }, [messages, currentSubsection]);

  const lastAssistantText = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant');
    return getAssistantVoiceText(lastAssistant);
  }, [messages]);

  const fallback3AImageDisplay = useMemo((): ExamImageCard | null => {
    if (currentSection !== '3' || currentSubsection !== '3A') return null;

    const sectionThree = (examConfig.examConfig.sections as any)?.[3];
    const subsection3A = sectionThree?.subsections?.['3A'];
    const imageSet = subsection3A?.imageSets?.[0];

    if (
      !imageSet ||
      !Array.isArray(imageSet.images) ||
      imageSet.images.length === 0
    ) {
      return null;
    }

    return {
      title: imageSet.title || 'Image Description',
      description: imageSet.description || '',
      images: imageSet.images,
      imageSetId: `fallback-3A-${String(imageSet.setId ?? '1')}`,
      isExamImage: true,
      subsection: '3A',
      layout: imageSet.layout || 'side-by-side',
      instructions: imageSet.tasks || subsection3A?.instructions || [],
    };
  }, [examConfig, currentSection, currentSubsection]);

  useEffect(() => {
    if (!currentAudioPlayer?.recordingId) return;

    setPinnedAudioPlayer((prev) => {
      const isNewRecording =
        prev?.recordingId !== currentAudioPlayer.recordingId;
      if (isNewRecording) {
        setAudioPlayerReadyToShow(false);
        return currentAudioPlayer;
      }
      return prev;
    });
  }, [currentAudioPlayer?.recordingId, currentAudioPlayer]);

  useEffect(() => {
    if (!currentImageDisplay?.imageSetId) return;
    if (suppressImageUntilNextAssistant) return;
    if (dismissedImageSetIds.includes(currentImageDisplay.imageSetId)) return;
    setPinnedImageDisplay((prev) =>
      prev?.imageSetId === currentImageDisplay.imageSetId
        ? prev
        : currentImageDisplay,
    );
    setImageDisplayReadyToShow(false);
  }, [
    currentImageDisplay?.imageSetId,
    currentImageDisplay,
    suppressImageUntilNextAssistant,
    dismissedImageSetIds,
  ]);

  useEffect(() => {
    if (!fallback3AImageDisplay?.imageSetId) return;
    if (pinnedImageDisplay) return;
    if (suppressImageUntilNextAssistant) return;
    if (dismissedImageSetIds.includes(fallback3AImageDisplay.imageSetId))
      return;
    setPinnedImageDisplay(fallback3AImageDisplay);
    setImageDisplayReadyToShow(false);
  }, [
    fallback3AImageDisplay?.imageSetId,
    fallback3AImageDisplay,
    pinnedImageDisplay,
    suppressImageUntilNextAssistant,
    dismissedImageSetIds,
  ]);

  useEffect(() => {
    setSuppressImageUntilNextAssistant(false);
  }, [latestAssistantMessageId]);

  useEffect(() => {
    if (!pinnedAudioPlayer) {
      setAudioPlayerReadyToShow(false);
      return;
    }

    if (!aiSpeaking && !ttsLoading && !isPaused && status === 'ready') {
      setAudioPlayerReadyToShow(true);
    }
  }, [pinnedAudioPlayer, aiSpeaking, ttsLoading, isPaused, status]);

  useEffect(() => {
    if (!pinnedImageDisplay) {
      setImageDisplayReadyToShow(false);
      return;
    }

    if (!aiSpeaking && !ttsLoading && !isPaused && status === 'ready') {
      setImageDisplayReadyToShow(true);
    }
  }, [pinnedImageDisplay, aiSpeaking, ttsLoading, isPaused, status]);

  const currentAudioIsCompleted =
    !!pinnedAudioPlayer?.recordingId &&
    completedExamAudioIds.includes(pinnedAudioPlayer.recordingId);

  const shouldAutoPlayCurrentAudio =
    !!pinnedAudioPlayer &&
    audioPlayerReadyToShow &&
    pinnedAudioPlayer.isExamRecording &&
    !currentAudioIsCompleted &&
    !aiSpeaking &&
    !ttsLoading &&
    !isPaused &&
    status === 'ready';

  const showAudioPlayer = !!pinnedAudioPlayer && audioPlayerReadyToShow;
  const showImageDisplay = !!pinnedImageDisplay && imageDisplayReadyToShow;

  const debugLogPayload = useMemo(() => {
    const simplifiedMessages = messages.map((message) => {
      const text = message.parts
        ?.filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim();

      const toolInvocations: Array<{
        toolName: string;
        state: string;
        args: unknown;
        result: unknown;
      }> = [];

      for (const part of message.parts || []) {
        if (part.type !== 'tool-invocation') continue;

        const invocation = part.toolInvocation;
        if (!invocation?.toolName) continue;

        toolInvocations.push({
          toolName: invocation.toolName,
          state: invocation.state,
          args: invocation.args ?? null,
          result:
            invocation.state === 'result' ? (invocation.result ?? null) : null,
        });
      }

      return {
        id: message.id,
        role: message.role,
        text: text || '',
        toolInvocations,
      };
    });

    return {
      exportedAt: new Date().toISOString(),
      chatId: id,
      examModel: examType,
      examName: examConfig.name,
      currentSection,
      currentSubsection,
      examCompletionPhase,
      status,
      transcriptTurns,
      messages: simplifiedMessages,
      streamEvents: dataStream,
      pinnedAudioPlayer,
      pinnedImageDisplay,
    };
  }, [
    messages,
    id,
    examType,
    examConfig.name,
    currentSection,
    currentSubsection,
    examCompletionPhase,
    status,
    transcriptTurns,
    dataStream,
    pinnedAudioPlayer,
    pinnedImageDisplay,
  ]);

  const handleCopyDebugLog = useCallback(async () => {
    if (isCopyingDebugLog) return;
    setIsCopyingDebugLog(true);

    try {
      const payloadText = JSON.stringify(debugLogPayload, null, 2);
      await navigator.clipboard.writeText(payloadText);
      toast({
        type: 'success',
        description:
          'Exam debug log copied. Paste it here and I can tune the flow.',
      });
    } catch (_error) {
      toast({
        type: 'error',
        description:
          'Could not copy debug log. Your browser blocked clipboard access.',
      });
    } finally {
      setIsCopyingDebugLog(false);
    }
  }, [debugLogPayload, isCopyingDebugLog]);

  // ── Derived phase ──
  const phase: OrbPhase = useMemo(() => {
    if (aiSpeaking) return 'speaking';
    if (isRecording) return 'listening';
    if (ttsLoading || status === 'streaming' || status === 'submitted')
      return 'thinking';
    return 'idle';
  }, [aiSpeaking, isRecording, ttsLoading, status]);

  // ── Auto-start exam ──
  useEffect(() => {
    if (hasStartedRef.current || !examStarted || !examType || !examStartTime)
      return;

    const ssKey = `exam-started:${id}:${examStartTime.getTime()}`;
    examStartMarkerKeyRef.current = ssKey;
    const alreadyInStorage =
      typeof window !== 'undefined' && sessionStorage.getItem(ssKey) === '1';
    if (alreadyInStorage) {
      hasStartedRef.current = true;
      return;
    }

    hasStartedRef.current = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ssKey, '1');
      // Legacy key cleanup from older versions
      sessionStorage.removeItem(`exam-started:${id}`);
    }
    append({
      role: 'user',
      content: EXAM_START_TRIGGER_MESSAGE,
    });
  }, [examStarted, examType, examStartTime, append, id]);

  useEffect(() => {
    if (examStarted) return;

    hasStartedRef.current = false;
    subsectionRecoverySentRef.current.clear();
    if (typeof window !== 'undefined') {
      if (examStartMarkerKeyRef.current) {
        sessionStorage.removeItem(examStartMarkerKeyRef.current);
      }
      // Legacy key cleanup from older versions
      sessionStorage.removeItem(`exam-started:${id}`);
    }
    examStartMarkerKeyRef.current = null;
  }, [examStarted, id]);

  useEffect(() => {
    if (!examStarted || !examType) return;
    if (examCompletionPhase !== 'active') return;
    if (!currentSection || !currentSubsection) return;
    if (!hasExamRunStarted) return;

    const locationKey = `${currentSection}:${currentSubsection}`;
    if (hasMediaForCurrentSubsection) {
      subsectionRecoverySentRef.current.delete(locationKey);
      return;
    }

    if (
      status !== 'ready' ||
      aiSpeaking ||
      ttsLoading ||
      isPaused ||
      isExamAudioPlaying
    ) {
      return;
    }

    if (subsectionRecoverySentRef.current.has(locationKey)) return;
    subsectionRecoverySentRef.current.add(locationKey);

    append({
      role: 'user',
      content: `[System] Continue the exam at Section ${currentSection}, Subsection ${currentSubsection}. Do NOT complete the exam now. Provide the correct examiner prompt for this subsection and call the required media tool for this subsection before asking for the candidate response.`,
    });
  }, [
    examStarted,
    examType,
    examCompletionPhase,
    currentSection,
    currentSubsection,
    hasExamRunStarted,
    hasMediaForCurrentSubsection,
    status,
    aiSpeaking,
    ttsLoading,
    isPaused,
    isExamAudioPlaying,
    append,
  ]);

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

  // Track how much text we've already sent to TTS for the current streaming message
  const sentCharsRef = useRef(0);
  const currentStreamMsgId = useRef<string | null>(null);

  // ── Extract sentences while streaming and enqueue TTS immediately ──
  useEffect(() => {
    // Find the latest assistant message (may not be the very last if tool results follow)
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;

    const text = getAssistantVoiceText(last);
    if (!text) return;

    // Skip the very first assistant message (welcome/description)
    if (!firstAssistantSeen.current) {
      if (status === 'ready' && last.id !== lastAutoTTSId.current) {
        firstAssistantSeen.current = true;
        lastAutoTTSId.current = last.id;
        setTeleprompterText(text);
      }
      return;
    }

    // Guard: Skip if we've already processed this message (prevent duplicate TTS after re-renders)
    if (last.id === lastAutoTTSId.current) {
      return;
    }

    // New message started streaming
    if (last.id !== currentStreamMsgId.current) {
      currentStreamMsgId.current = last.id;
      sentCharsRef.current = 0;
      resetStreamingTTS();
      setUserCaptionText('');
    }

    if (!ttsEnabled) {
      setTeleprompterText(text);
      return;
    }

    // Extract new complete sentences from the unprocessed portion
    const unprocessed = text.slice(sentCharsRef.current);
    const { sentences, consumed } = extractSentences(unprocessed);

    for (const sentence of sentences) {
      enqueueSentence(sentence, { messageId: last.id });
    }

    if (consumed > 0) {
      sentCharsRef.current += consumed;
    }

    // When streaming finishes, flush any remaining text
    if (status === 'ready' && last.id !== lastAutoTTSId.current) {
      lastAutoTTSId.current = last.id;
      const remaining = text.slice(sentCharsRef.current).trim();
      if (remaining) {
        enqueueSentence(remaining, { messageId: last.id });
        sentCharsRef.current = text.length;
      }
      setTeleprompterText(text);
      setTranscriptTurns((prev) => [...prev, { speaker: 'EXAMINER', text }]);
    }
  }, [status, messages, ttsEnabled, enqueueSentence, resetStreamingTTS]);

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
    isRecordingRef.current = false;
    setInterimText('');
    interimRef.current = '';
  }, []);

  const beginCompletionFlow = useCallback(
    (assistantCountAtRequest: number) => {
      completionRequestRef.current = {
        assistantCountAtRequest,
        watchdogRetrySent: false,
      };
      setExamCompletionPhase((previous) =>
        previous === 'complete' ? previous : 'evaluating',
      );
      stopListening();
    },
    [stopListening],
  );

  // ── Exam completion sequencing ──
  useEffect(() => {
    if (!dataStream?.length) return;

    const start = lastProcessedCompletionEventIndexRef.current + 1;
    const deltas = dataStream.slice(start);
    lastProcessedCompletionEventIndexRef.current = dataStream.length - 1;

    for (const delta of deltas as any[]) {
      if (
        delta?.type === 'exam-section-control' &&
        delta?.content?.action === 'complete_exam'
      ) {
        if (examCompletionPhase === 'active') {
          beginCompletionFlow(assistantMessages.length);
        }
        break;
      }
    }
  }, [
    dataStream,
    assistantMessages.length,
    beginCompletionFlow,
    examCompletionPhase,
  ]);

  useEffect(() => {
    if (examCompletionPhase !== 'evaluating') return;

    const assistantCountAtRequest =
      completionRequestRef.current?.assistantCountAtRequest ?? 0;

    if (
      status === 'streaming' ||
      status === 'submitted' ||
      assistantMessages.length > assistantCountAtRequest
    ) {
      setExamCompletionPhase((previous) =>
        previous === 'complete' ? previous : 'delivering',
      );
    }
  }, [examCompletionPhase, status, assistantMessages.length]);

  useEffect(() => {
    if (examCompletionPhase !== 'evaluating') return;
    if (completionRequestRef.current?.watchdogRetrySent) return;

    const timer = window.setTimeout(() => {
      if (completionRequestRef.current?.watchdogRetrySent) return;
      completionRequestRef.current = {
        assistantCountAtRequest:
          completionRequestRef.current?.assistantCountAtRequest ??
          assistantMessages.length,
        watchdogRetrySent: true,
      };
      append({
        role: 'user',
        content:
          '[System] Please provide the final evaluation now and confirm exam completion.',
      });
    }, 12000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [examCompletionPhase, append, assistantMessages.length]);

  useEffect(() => {
    if (examCompletionPhase !== 'delivering') return;

    const assistantCountAtRequest =
      completionRequestRef.current?.assistantCountAtRequest ?? 0;
    const hasDeliveredResponse =
      assistantMessages.length > assistantCountAtRequest;

    if (
      status === 'ready' &&
      !aiSpeaking &&
      !ttsLoading &&
      !!lastAssistantText &&
      hasDeliveredResponse
    ) {
      setExamCompletionPhase('complete');
    }
  }, [
    examCompletionPhase,
    status,
    assistantMessages.length,
    aiSpeaking,
    ttsLoading,
    lastAssistantText,
  ]);

  const startListening = useCallback(() => {
    if (isRecordingRef.current || aiSpeaking || isPaused) return;
    if (examCompletionPhase !== 'active') return;

    const Ctor =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null;
    if (!Ctor) {
      toast({
        type: 'error',
        description: 'Speech recognition not supported in this browser.',
      });
      return;
    }

    transcriptRef.current = '';
    interimRef.current = '';
    setInterimText('');

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
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
      interimRef.current = interim;
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      const errType = event?.error || 'unknown';
      // "aborted" is expected when we stop() manually
      if (errType !== 'aborted') {
        toast({
          type: 'error',
          description: `Mic error: ${errType}. Check mic permissions.`,
        });
      }
      stopListening();
    };

    recognition.onend = () => {
      // If the user is still pressing, restart recognition (Chrome auto-stops)
      if (pressingRef.current && recognitionRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through to stop */
        }
      }
      setIsRecording(false);
      isRecordingRef.current = false;
      setInterimText('');
      interimRef.current = '';
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      isRecordingRef.current = true;
    } catch (_err) {
      toast({
        type: 'error',
        description: 'Failed to start speech recognition.',
      });
    }
  }, [aiSpeaking, isPaused, stopListening, examCompletionPhase]);

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

    // Snapshot interim from ref (always fresh, no stale closure)
    const interimSnapshot = interimRef.current.trim();
    stopListening();

    // Short delay to let the recognition engine flush its last result
    setTimeout(() => {
      let text = transcriptRef.current.trim();
      // If recognition didn't finalize but we had interim, use it
      if (!text && interimSnapshot) text = interimSnapshot;
      if (!text) return;
      setUserCaptionText(text);
      setTranscriptTurns((prev) => [...prev, { speaker: 'YOU', text }]);
      setPinnedAudioPlayer(null);
      setAudioPlayerReadyToShow(false);
      setIsExamAudioPlaying(false);
      const imageSetId = pinnedImageDisplay?.imageSetId;
      if (imageSetId) {
        setDismissedImageSetIds((prev) =>
          prev.includes(imageSetId) ? prev : [...prev, imageSetId],
        );
      }
      setPinnedImageDisplay(null);
      setImageDisplayReadyToShow(false);
      setSuppressImageUntilNextAssistant(true);
      append({ role: 'user', content: text });
    }, 200);
  }, [stopListening, append, pinnedImageDisplay]);

  // ── Repeat last examiner message ──
  const handleRepeat = useCallback(() => {
    const lastExaminer = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastExaminer) return;
    const text = getAssistantVoiceText(lastExaminer);
    if (text) speakTTSSingle(text, { messageId: lastExaminer.id });
  }, [messages, speakTTSSingle]);

  const stopAllTTS = useCallback(() => {
    stopStreamingTTS();
    stopTTSSingle();
  }, [stopStreamingTTS, stopTTSSingle]);

  // ── Pause / Resume ──
  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
    } else {
      stopAllTTS();
      stopListening();
      setIsPaused(true);
    }
  }, [isPaused, stopAllTTS, stopListening]);

  // ── End exam ──
  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    stopAllTTS();
    stopListening();
    stopChat();
    endExam();
  }, [stopAllTTS, stopListening, stopChat, endExam]);

  const handleEndExam = useCallback(() => {
    if (examCompletionPhase === 'complete') {
      handleConfirmExit();
      return;
    }

    if (
      examCompletionPhase === 'evaluating' ||
      examCompletionPhase === 'delivering'
    ) {
      setShowExitConfirm(true);
      return;
    }

    // Active session: request final evaluation and keep the exam open
    stopAllTTS();
    stopListening();
    stopChat();
    beginCompletionFlow(assistantMessages.length);
    append({
      role: 'user',
      content: EXAM_FINISH_TRIGGER_MESSAGE,
    });
  }, [
    examCompletionPhase,
    handleConfirmExit,
    stopAllTTS,
    stopListening,
    stopChat,
    beginCompletionFlow,
    assistantMessages.length,
    append,
  ]);

  useEffect(() => {
    if (examCompletionPhase !== 'complete') {
      hasAutoClosedRef.current = false;
      setAutoCloseCountdown(AUTO_CLOSE_SECONDS);
      return;
    }

    setAutoCloseCountdown(AUTO_CLOSE_SECONDS);

    const interval = window.setInterval(() => {
      setAutoCloseCountdown((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          if (!hasAutoClosedRef.current) {
            hasAutoClosedRef.current = true;
            handleConfirmExit();
          }
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [examCompletionPhase, handleConfirmExit]);

  // ── Global spacebar PTT ──
  useEffect(() => {
    const canPTT = () =>
      examCompletionPhase === 'active' &&
      !aiSpeaking &&
      !ttsLoading &&
      !isExamAudioPlaying &&
      !isPaused &&
      status !== 'streaming' &&
      status !== 'submitted';

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' && !e.repeat && canPTT()) {
        e.preventDefault();
        onPTTStart();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onPTTEnd();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    examCompletionPhase,
    aiSpeaking,
    ttsLoading,
    isExamAudioPlaying,
    isPaused,
    status,
    onPTTStart,
    onPTTEnd,
  ]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      stopListening();
      stopAllTTS();
    };
  }, [stopListening, stopAllTTS]);

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

          {examCompletionPhase === 'evaluating' && (
            <div className="mb-4 rounded-md border bg-muted/40 px-4 py-3 text-center max-w-2xl">
              <p className="text-sm font-medium text-foreground">
                Thank you. I&apos;m reviewing your final response.
              </p>
              <p className="text-xs text-muted-foreground">
                Please wait a moment while I finalize your evaluation.
              </p>
            </div>
          )}

          {examCompletionPhase === 'complete' && (
            <div className="mb-4 rounded-md border border-green-600/20 bg-green-500/10 px-4 py-3 text-center max-w-2xl">
              <p className="text-sm font-medium text-foreground">
                Evaluation complete.
              </p>
              <p className="text-xs text-muted-foreground">
                Your final response has been evaluated. This exam is now
                concluded.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Closing automatically in {autoCloseCountdown}s.
              </p>
            </div>
          )}

          {/* ─── Unified caption area ─── */}
          <div className="text-center max-w-lg mb-6 min-h-16 flex flex-col items-center justify-center px-4 gap-2">
            <AnimatePresence mode="wait">
              {/* Examiner captions — sentence-by-sentence from streaming TTS */}
              {aiSpeakingStream && currentSentence ? (
                <motion.p
                  key={`examiner-${currentSentence.slice(0, 30)}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg md:text-xl font-medium leading-relaxed text-foreground"
                >
                  {currentSentence}
                </motion.p>
              ) : aiSpeakingSingle && teleprompterText ? (
                /* Single-shot TTS (Repeat) — show full text */
                <motion.p
                  key="examiner-repeat"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg md:text-xl font-medium leading-relaxed text-foreground"
                >
                  {teleprompterText.split('\n')[0].slice(0, 200)}
                </motion.p>
              ) : ttsLoadingStream ? (
                /* Loading first sentence */
                <motion.p
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-muted-foreground"
                >
                  Preparing response...
                </motion.p>
              ) : isRecording ? (
                /* User live caption — green, while recording */
                <motion.p
                  key="user-live"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-lg md:text-xl font-medium leading-relaxed text-green-400"
                >
                  {transcriptRef.current || interimText || 'Listening...'}
                  {transcriptRef.current && interimText && (
                    <span className="text-green-400/50"> {interimText}</span>
                  )}
                </motion.p>
              ) : userCaptionText && !ttsLoading ? (
                /* User submitted caption — green, after release */
                <motion.p
                  key="user-sent"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg md:text-xl font-medium leading-relaxed text-green-400"
                >
                  {userCaptionText}
                </motion.p>
              ) : !teleprompterText ? (
                /* Welcome fallback */
                <motion.p
                  key="welcome"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-foreground/60"
                >
                  {examConfig.messagesConfig.welcomeMessage.split('\n')[0] ||
                    'Welcome.'}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          {/* ─── Audio Player (when exam audio is played) ─── */}
          {showAudioPlayer && pinnedAudioPlayer && (
            <div className="w-full max-w-lg mb-4">
              <AudioPlayer
                src={pinnedAudioPlayer.src}
                title={pinnedAudioPlayer.title}
                description={pinnedAudioPlayer.description}
                recordingId={pinnedAudioPlayer.recordingId}
                isExamRecording={pinnedAudioPlayer.isExamRecording}
                isCompleted={currentAudioIsCompleted}
                subsection={pinnedAudioPlayer.subsection}
                audioFile={pinnedAudioPlayer.audioFile}
                maxReplays={pinnedAudioPlayer.maxReplays}
                allowSeek={pinnedAudioPlayer.allowSeek}
                autoPlay={shouldAutoPlayCurrentAudio}
                onPlaybackStateChange={setIsExamAudioPlaying}
                onComplete={() => {
                  const recordingId = pinnedAudioPlayer.recordingId;
                  if (!recordingId) return;

                  setCompletedExamAudioIds((prev) =>
                    prev.includes(recordingId) ? prev : [...prev, recordingId],
                  );

                  if (handledAudioCompletionRef.current.has(recordingId))
                    return;
                  handledAudioCompletionRef.current.add(recordingId);

                  append({
                    role: 'user',
                    content:
                      '[System] The exam audio playback has finished. Continue with the next step in this subsection.',
                  });
                }}
              />
            </div>
          )}

          {showImageDisplay && pinnedImageDisplay && (
            <div className="w-full max-w-3xl mb-4">
              <ImageDisplay
                title={pinnedImageDisplay.title}
                description={pinnedImageDisplay.description}
                images={pinnedImageDisplay.images}
                imageSetId={pinnedImageDisplay.imageSetId}
                isExamImage={pinnedImageDisplay.isExamImage}
                subsection={pinnedImageDisplay.subsection}
                layout={pinnedImageDisplay.layout || 'single'}
                instructions={pinnedImageDisplay.instructions || []}
              />
            </div>
          )}

          {/* ─── Push-to-Talk button ─── */}
          {examCompletionPhase === 'active' ? (
            <Button
              size="lg"
              className={`rounded-full px-8 py-6 text-base ${isRecording ? 'bg-green-600 hover:bg-green-700' : ''}`}
              onMouseDown={onPTTStart}
              onMouseUp={onPTTEnd}
              onMouseLeave={onPTTEnd}
              onTouchStart={onPTTStart}
              onTouchEnd={onPTTEnd}
              onTouchCancel={onPTTEnd}
              disabled={
                aiSpeaking ||
                ttsLoading ||
                isExamAudioPlaying ||
                isPaused ||
                status === 'streaming' ||
                status === 'submitted'
              }
            >
              <Mic className="size-5 mr-2" />
              {isRecording ? 'Release to Send' : 'Push to Talk'}
              <span className="ml-2 text-xs opacity-50">[space]</span>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Microphone disabled while finalizing the exam.
            </p>
          )}
        </div>

        {/* ─── Bottom toolbar ─── */}
        <div className="flex items-center justify-center gap-6 px-4 py-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRepeat}
            disabled={
              examCompletionPhase !== 'active' || aiSpeaking || isPaused
            }
            title="Repeat last instruction"
          >
            <RotateCcw className="size-4 mr-1.5" />
            Repeat
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={togglePause}
            disabled={examCompletionPhase !== 'active'}
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
            data-testid="exam-transcript-toggle"
          >
            {showTranscript ? (
              <PanelRightClose className="size-4 mr-1.5" />
            ) : (
              <PanelRightOpen className="size-4 mr-1.5" />
            )}
            Transcript
          </Button>

          {examCompletionPhase === 'complete' ? (
            <Button size="sm" onClick={handleConfirmExit} title="Close exam">
              Close Exam
            </Button>
          ) : (
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
          )}
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
              onCopyDebugLog={handleCopyDebugLog}
              isCopyingDebugLog={isCopyingDebugLog}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Final evaluation is in progress. Exit now?
            </AlertDialogTitle>
            <AlertDialogDescription>
              If you exit now, the final evaluation may not be fully delivered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit}>
              Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden data stream handler for exam control events */}
      <DataStreamHandler id={id} dataStream={dataStream} />
    </div>
  );
}
