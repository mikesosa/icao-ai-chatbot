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
import { useIsMobile } from '@/hooks/use-mobile';
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

function getMessagePlainText(message: UIMessage | null | undefined): string {
  if (!message?.parts) return '';

  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function normalizeControllerRolePlayText(
  text: string,
  isControllerRolePlaySubsection: boolean,
): string {
  if (!text || !isControllerRolePlaySubsection) return text;

  const hasControllerLine = /(^|\n)\s*controller:/i.test(text);
  if (!hasControllerLine) return text;

  const blocks = text.split(/\n\s*\n/).map((block) => block.trim());
  const keptBlocks = blocks.filter(
    (block) => block.length > 0 && !/^controller:/i.test(block),
  );
  const merged = keptBlocks.join('\n\n').trim();

  if (!merged) {
    return 'Pilot: Please respond as the controller.';
  }

  if (!/please respond as the controller/i.test(merged)) {
    return `${merged}\n\nPlease respond as the controller.`;
  }

  return merged;
}

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

function getAssistantVoiceText(
  message: UIMessage | null | undefined,
  context?: {
    isControllerRolePlaySubsection?: boolean;
    currentSubsectionHasImages?: boolean;
    currentSubsectionLabel?: string;
    awaitingInitialMediaForSubsection?: boolean;
  },
): string {
  if (!message?.parts) return '';

  const rawText = getMessagePlainText(message);
  const isControllerRolePlaySubsection =
    context?.isControllerRolePlaySubsection === true;
  const currentSubsectionHasImages =
    context?.currentSubsectionHasImages === true;
  const currentSubsectionLabel = context?.currentSubsectionLabel;

  let examAudioInstruction: string | null = null;
  let examImageInstruction: string | null = null;

  for (const part of message.parts) {
    if (part.type !== 'tool-invocation' || !part.toolInvocation) {
      continue;
    }

    const invocation = part.toolInvocation;
    const details =
      invocation.state === 'result'
        ? (invocation.result as any)?.details
        : invocation.args;

    if (
      invocation.toolName === 'playAudio' &&
      (details?.isExamRecording || typeof details?.subsection === 'string')
    ) {
      // Keep audio turns deterministic in voice mode: present one neutral playback instruction.
      examAudioInstruction = 'Press Play to listen.';
      continue;
    }

    if (
      invocation.toolName === 'displayImage' &&
      (details?.isExamImage || typeof details?.subsection === 'string')
    ) {
      const description =
        typeof details.description === 'string'
          ? details.description.trim()
          : '';

      if (currentSubsectionHasImages) {
        const isGenericExamDescription =
          description.length === 0 ||
          /visual stimulus|operational communication scenario|image set|task\s*(ii|two)\b/i.test(
            description,
          );
        const transitionText = currentSubsectionLabel
          ? `Now we are moving to ${currentSubsectionLabel}. Now I will show you an operational image. Please describe what you see.`
          : 'Now I will show you an operational image. Please describe what you see.';

        examImageInstruction = description
          ? isGenericExamDescription
            ? transitionText
            : description
          : transitionText;
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

  if (context?.awaitingInitialMediaForSubsection) {
    // Do not surface assistant text until the required media tool call appears for this subsection.
    return '';
  }

  return normalizeControllerRolePlayText(
    rawText,
    isControllerRolePlaySubsection,
  );
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
      <p className="truncate text-xs text-muted-foreground">
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
type TranscriptTurn = {
  speaker: 'EXAMINER' | 'YOU';
  text: string;
  messageId?: string;
};
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
  allowPause?: boolean;
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

type VoiceAlignmentEvent = {
  id: number;
  timestamp: string;
  channel:
    | 'assistant_raw'
    | 'teleprompter'
    | 'tts_queue'
    | 'tts_stream_sentence'
    | 'user_caption'
    | 'transcript_turn';
  text: string;
  messageId?: string | null;
  speaker?: 'EXAMINER' | 'YOU';
  status?: string;
};

type RuntimeImageSet = {
  setId?: string | number;
  title?: string;
  description?: string;
  layout?: 'single' | 'side-by-side' | 'stacked';
  images?: Array<{
    url: string;
    alt?: string;
    caption?: string;
  }>;
  tasks?: string[];
};

type RuntimeSubsectionConfig = {
  name?: string;
  description?: string;
  instructions?: string[];
  audioFiles?: Array<unknown>;
  imageSets?: RuntimeImageSet[];
};

function getSubsectionMetadataText(
  subsection: RuntimeSubsectionConfig,
): string {
  const parts: string[] = [];
  if (typeof subsection.name === 'string') parts.push(subsection.name);
  if (typeof subsection.description === 'string')
    parts.push(subsection.description);
  if (Array.isArray(subsection.instructions)) {
    parts.push(
      ...subsection.instructions.filter(
        (instruction): instruction is string => typeof instruction === 'string',
      ),
    );
  }

  return parts.join('\n').toLowerCase();
}

function subsectionHasMedia(subsection: RuntimeSubsectionConfig): boolean {
  const hasAudio =
    Array.isArray(subsection.audioFiles) && subsection.audioFiles.length > 0;
  const hasImages =
    Array.isArray(subsection.imageSets) && subsection.imageSets.length > 0;
  return hasAudio || hasImages;
}

function subsectionIsControllerRolePlay(
  subsection: RuntimeSubsectionConfig,
): boolean {
  const text = getSubsectionMetadataText(subsection);
  return (
    /\brole[- ]?play\b/.test(text) &&
    /candidate[^.\n]*controller|controller[^.\n]*candidate/.test(text)
  );
}

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
            key={`turn-${turn.messageId ?? 'nomsg'}-${turn.speaker}-${i}`}
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

  const isMobile = useIsMobile();

  // ── Local state ──
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [voiceAlignmentEvents, setVoiceAlignmentEvents] = useState<
    VoiceAlignmentEvent[]
  >([]);
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
  const rolePlayCorrectionSentRef = useRef<Set<string>>(new Set());
  const finalizedAssistantTextByIdRef = useRef<Map<string, string>>(new Map());
  const voiceAlignmentEventIdRef = useRef(0);
  // Track the first AI response (welcome/description) so we skip TTS for it
  const firstAssistantSeen = useRef(false);

  const appendVoiceAlignmentEvent = useCallback(
    (event: Omit<VoiceAlignmentEvent, 'id' | 'timestamp'>) => {
      const nextEvent: VoiceAlignmentEvent = {
        ...event,
        id: ++voiceAlignmentEventIdRef.current,
        timestamp: new Date().toISOString(),
      };
      setVoiceAlignmentEvents((previous) => {
        const merged = [...previous, nextEvent];
        return merged.length > 250 ? merged.slice(-250) : merged;
      });
    },
    [],
  );

  const subsectionConfigsByLocation = useMemo(() => {
    const locations = new Map<string, RuntimeSubsectionConfig>();
    const sections =
      (examConfig.examConfig.sections as Record<
        string,
        { subsections?: Record<string, RuntimeSubsectionConfig> }
      >) || {};

    for (const [sectionKey, sectionConfig] of Object.entries(sections)) {
      for (const [subsectionKey, subsectionConfig] of Object.entries(
        sectionConfig?.subsections || {},
      )) {
        locations.set(`${sectionKey}:${subsectionKey}`, subsectionConfig);
      }
    }

    return locations;
  }, [examConfig]);

  const currentSubsectionLocationKey =
    currentSection && currentSubsection
      ? `${currentSection}:${currentSubsection}`
      : null;

  const currentSubsectionConfig = useMemo(() => {
    if (!currentSubsectionLocationKey) return null;
    return (
      subsectionConfigsByLocation.get(currentSubsectionLocationKey) ?? null
    );
  }, [currentSubsectionLocationKey, subsectionConfigsByLocation]);

  const currentSubsectionHasImages = useMemo(
    () =>
      !!(
        currentSubsectionConfig &&
        Array.isArray(currentSubsectionConfig.imageSets) &&
        currentSubsectionConfig.imageSets.length > 0
      ),
    [currentSubsectionConfig],
  );

  const currentSubsectionLabel = useMemo(() => {
    if (currentSubsectionConfig?.name) return currentSubsectionConfig.name;
    if (currentSubsection) return `Subsection ${currentSubsection}`;
    return 'this subsection';
  }, [currentSubsectionConfig, currentSubsection]);

  const rolePlaySubsectionLocations = useMemo(() => {
    const locations = new Set<string>();

    for (const [locationKey, subsectionConfig] of subsectionConfigsByLocation) {
      if (subsectionIsControllerRolePlay(subsectionConfig)) {
        locations.add(locationKey);
      }
    }

    return locations;
  }, [subsectionConfigsByLocation]);

  const mediaRequiredSubsectionLocations = useMemo(() => {
    const locations = new Set<string>();

    for (const [locationKey, subsectionConfig] of subsectionConfigsByLocation) {
      if (subsectionHasMedia(subsectionConfig)) {
        locations.add(locationKey);
      }
    }

    return locations;
  }, [subsectionConfigsByLocation]);

  const isControllerRolePlaySubsection = useMemo(() => {
    if (!currentSubsectionLocationKey) return false;
    return rolePlaySubsectionLocations.has(currentSubsectionLocationKey);
  }, [currentSubsectionLocationKey, rolePlaySubsectionLocations]);

  const currentSubsectionRequiresMedia = useMemo(() => {
    if (!currentSubsectionLocationKey) return false;
    return mediaRequiredSubsectionLocations.has(currentSubsectionLocationKey);
  }, [currentSubsectionLocationKey, mediaRequiredSubsectionLocations]);

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
            allowPause: details.allowPause,
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
  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant') ?? null,
    [messages],
  );
  const latestAssistantRawText = useMemo(
    () => getMessagePlainText(latestAssistantMessage),
    [latestAssistantMessage],
  );

  useEffect(() => {
    if (!latestAssistantMessage?.id || !latestAssistantRawText) return;
    appendVoiceAlignmentEvent({
      channel: 'assistant_raw',
      messageId: latestAssistantMessage.id,
      text: latestAssistantRawText,
      status,
    });
  }, [
    latestAssistantMessage?.id,
    latestAssistantRawText,
    status,
    appendVoiceAlignmentEvent,
  ]);

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

    const pinnedAudioForSubsection =
      pinnedAudioPlayer?.subsection === currentSubsection;
    const pinnedImageForSubsection =
      pinnedImageDisplay?.subsection === currentSubsection;
    if (pinnedAudioForSubsection || pinnedImageForSubsection) return true;

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
  }, [messages, currentSubsection, pinnedAudioPlayer, pinnedImageDisplay]);

  const hasPendingMediaCallForCurrentSubsection = useMemo(() => {
    if (!currentSubsection) return false;

    return messages.some((message) => {
      if (message.role !== 'assistant' || !message.parts) return false;

      return message.parts.some((part) => {
        if (part.type !== 'tool-invocation') return false;
        const invocation = part.toolInvocation;
        if (invocation?.state !== 'call') return false;
        if (
          invocation.toolName !== 'playAudio' &&
          invocation.toolName !== 'displayImage'
        ) {
          return false;
        }

        const args = invocation.args as any;
        return args?.subsection === currentSubsection;
      });
    });
  }, [messages, currentSubsection]);

  const assistantVoiceContext = useMemo(
    () => ({
      isControllerRolePlaySubsection,
      currentSubsectionHasImages,
      currentSubsectionLabel,
      awaitingInitialMediaForSubsection:
        currentSubsectionRequiresMedia &&
        !hasMediaForCurrentSubsection &&
        !hasPendingMediaCallForCurrentSubsection,
    }),
    [
      isControllerRolePlaySubsection,
      currentSubsectionHasImages,
      currentSubsectionLabel,
      currentSubsectionRequiresMedia,
      hasMediaForCurrentSubsection,
      hasPendingMediaCallForCurrentSubsection,
    ],
  );

  const lastAssistantText = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant');
    return getAssistantVoiceText(lastAssistant, assistantVoiceContext);
  }, [messages, assistantVoiceContext]);

  const fallbackSubsectionImageDisplay = useMemo((): ExamImageCard | null => {
    if (!currentSubsection || !currentSubsectionConfig) return null;

    const imageSet = Array.isArray(currentSubsectionConfig.imageSets)
      ? currentSubsectionConfig.imageSets[0]
      : null;

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
      images: imageSet.images.map((image) => ({
        url: image.url,
        alt: image.alt || 'Exam image',
        caption: image.caption,
      })),
      imageSetId: `fallback-${currentSubsection}-${String(imageSet.setId ?? '1')}`,
      isExamImage: true,
      subsection: currentSubsection,
      layout: imageSet.layout || 'side-by-side',
      instructions:
        imageSet.tasks || currentSubsectionConfig.instructions || [],
    };
  }, [currentSubsection, currentSubsectionConfig]);

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
    if (!fallbackSubsectionImageDisplay?.imageSetId) return;
    if (pinnedImageDisplay) return;
    if (suppressImageUntilNextAssistant) return;
    if (
      dismissedImageSetIds.includes(fallbackSubsectionImageDisplay.imageSetId)
    )
      return;
    setPinnedImageDisplay(fallbackSubsectionImageDisplay);
    setImageDisplayReadyToShow(false);
  }, [
    fallbackSubsectionImageDisplay?.imageSetId,
    fallbackSubsectionImageDisplay,
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
      voiceAlignment: {
        snapshot: {
          latestAssistantMessageId: latestAssistantMessage?.id ?? null,
          latestAssistantRawText,
          lastAssistantText,
          teleprompterText,
          currentSentence,
          userCaptionText,
          interimText,
          aiSpeaking,
          ttsLoading,
          ttsEnabled,
        },
        events: voiceAlignmentEvents,
      },
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
    latestAssistantMessage?.id,
    latestAssistantRawText,
    lastAssistantText,
    teleprompterText,
    currentSentence,
    userCaptionText,
    interimText,
    aiSpeaking,
    ttsLoading,
    ttsEnabled,
    voiceAlignmentEvents,
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

  useEffect(() => {
    if (!currentSentence) return;
    appendVoiceAlignmentEvent({
      channel: 'tts_stream_sentence',
      messageId: currentStreamMsgId.current,
      text: currentSentence,
      status,
    });
  }, [currentSentence, status, appendVoiceAlignmentEvent]);

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
    rolePlayCorrectionSentRef.current.clear();
    finalizedAssistantTextByIdRef.current.clear();
    voiceAlignmentEventIdRef.current = 0;
    setVoiceAlignmentEvents([]);
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
    if (!examStarted || examCompletionPhase !== 'active') return;
    if (!isControllerRolePlaySubsection) return;
    if (!latestAssistantMessage?.id) return;
    if (status !== 'ready' || aiSpeaking || ttsLoading || isPaused) return;

    const messageId = latestAssistantMessage.id;
    if (rolePlayCorrectionSentRef.current.has(messageId)) return;

    const hasControllerLine = /(^|\n)\s*controller:/i.test(
      latestAssistantRawText,
    );
    const hasPilotLine = /(^|\n)\s*pilot:/i.test(latestAssistantRawText);
    if (!hasControllerLine || !hasPilotLine) return;

    rolePlayCorrectionSentRef.current.add(messageId);
    append({
      role: 'user',
      content:
        '[System] Role-play protocol reminder: speak ONLY as interlocutor. Do NOT provide candidate-side sample answers, model readbacks, or lines for both roles in the same turn. End each turn with one interlocutor prompt and wait for the candidate response.',
    });
  }, [
    examStarted,
    examCompletionPhase,
    isControllerRolePlaySubsection,
    latestAssistantMessage,
    latestAssistantRawText,
    status,
    aiSpeaking,
    ttsLoading,
    isPaused,
    append,
  ]);

  useEffect(() => {
    if (!examStarted || !examType) return;
    if (examCompletionPhase !== 'active') return;
    if (!currentSection || !currentSubsection || !currentSubsectionLocationKey)
      return;
    if (!hasExamRunStarted) return;
    if (!currentSubsectionRequiresMedia) return;

    const locationKey = currentSubsectionLocationKey;
    if (
      hasMediaForCurrentSubsection ||
      hasPendingMediaCallForCurrentSubsection
    ) {
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
    currentSubsectionLocationKey,
    currentSubsectionRequiresMedia,
    hasExamRunStarted,
    hasMediaForCurrentSubsection,
    hasPendingMediaCallForCurrentSubsection,
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
  const finalizeAssistantTimerRef = useRef<number | null>(null);
  const pendingAssistantFinalizeRef = useRef<{
    messageId: string;
    text: string;
  } | null>(null);

  const finalizeAssistantMessage = useCallback(
    (messageId: string, text: string, eventStatus: string) => {
      const finalizedText =
        finalizedAssistantTextByIdRef.current.get(messageId);
      if (finalizedText === text) return;

      if (sentCharsRef.current > text.length) {
        sentCharsRef.current = text.length;
      }

      const remaining = text.slice(sentCharsRef.current).trim();
      if (remaining) {
        enqueueSentence(remaining, { messageId });
        appendVoiceAlignmentEvent({
          channel: 'tts_queue',
          messageId,
          text: remaining,
          status: eventStatus,
        });
        sentCharsRef.current = text.length;
      }

      setTeleprompterText(text);
      appendVoiceAlignmentEvent({
        channel: 'teleprompter',
        messageId,
        text,
        status: eventStatus,
      });
      setTranscriptTurns((prev) => {
        const turn: TranscriptTurn = {
          speaker: 'EXAMINER',
          text,
          messageId,
        };
        const existingIndex = prev.findIndex(
          (candidate) =>
            candidate.speaker === 'EXAMINER' &&
            candidate.messageId === messageId,
        );
        const nextTurns =
          existingIndex >= 0
            ? prev.map((candidate, index) =>
                index === existingIndex ? turn : candidate,
              )
            : [...prev, turn];
        appendVoiceAlignmentEvent({
          channel: 'transcript_turn',
          speaker: 'EXAMINER',
          messageId,
          text,
          status: eventStatus,
        });
        return nextTurns;
      });
      finalizedAssistantTextByIdRef.current.set(messageId, text);
    },
    [enqueueSentence, appendVoiceAlignmentEvent],
  );

  // ── Extract sentences while streaming and enqueue TTS immediately ──
  useEffect(() => {
    // Find the latest assistant message (may not be the very last if tool results follow)
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last) return;

    const text = getAssistantVoiceText(last, assistantVoiceContext);
    if (!text) return;

    // Skip the very first assistant message (welcome/description)
    if (!firstAssistantSeen.current) {
      if (status === 'ready') {
        firstAssistantSeen.current = true;
        setTeleprompterText(text);
        appendVoiceAlignmentEvent({
          channel: 'teleprompter',
          messageId: last.id,
          text,
          status,
        });
      }
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
      appendVoiceAlignmentEvent({
        channel: 'teleprompter',
        messageId: last.id,
        text,
        status,
      });
      return;
    }

    // Extract new complete sentences from the unprocessed portion
    const unprocessed = text.slice(sentCharsRef.current);
    const { sentences, consumed } = extractSentences(unprocessed);

    for (const sentence of sentences) {
      enqueueSentence(sentence, { messageId: last.id });
      appendVoiceAlignmentEvent({
        channel: 'tts_queue',
        messageId: last.id,
        text: sentence,
        status,
      });
    }

    if (consumed > 0) {
      sentCharsRef.current += consumed;
    }

    // When ready, debounce finalization to avoid locking-in a partial chunk that
    // may still grow for the same assistant message id a few milliseconds later.
    if (status === 'ready') {
      const finalizedText = finalizedAssistantTextByIdRef.current.get(last.id);
      if (finalizedText === text) return;

      const pending = pendingAssistantFinalizeRef.current;
      if (pending?.messageId === last.id && pending.text === text) return;

      if (finalizeAssistantTimerRef.current) {
        window.clearTimeout(finalizeAssistantTimerRef.current);
      }

      pendingAssistantFinalizeRef.current = { messageId: last.id, text };
      finalizeAssistantTimerRef.current = window.setTimeout(() => {
        const currentPending = pendingAssistantFinalizeRef.current;
        if (!currentPending || currentPending.messageId !== last.id) return;

        finalizeAssistantMessage(
          currentPending.messageId,
          currentPending.text,
          status,
        );
        pendingAssistantFinalizeRef.current = null;
        finalizeAssistantTimerRef.current = null;
      }, 150);
      return;
    }

    if (finalizeAssistantTimerRef.current) {
      window.clearTimeout(finalizeAssistantTimerRef.current);
      finalizeAssistantTimerRef.current = null;
      pendingAssistantFinalizeRef.current = null;
    }
  }, [
    status,
    messages,
    ttsEnabled,
    enqueueSentence,
    resetStreamingTTS,
    assistantVoiceContext,
    appendVoiceAlignmentEvent,
    finalizeAssistantMessage,
  ]);

  useEffect(() => {
    return () => {
      if (finalizeAssistantTimerRef.current) {
        window.clearTimeout(finalizeAssistantTimerRef.current);
      }
    };
  }, []);

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
      appendVoiceAlignmentEvent({
        channel: 'user_caption',
        text,
        status,
      });
      setTranscriptTurns((prev) => {
        const turn: TranscriptTurn = { speaker: 'YOU', text };
        const nextTurns = [...prev, turn];
        appendVoiceAlignmentEvent({
          channel: 'transcript_turn',
          speaker: 'YOU',
          text,
          status,
        });
        return nextTurns;
      });
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
  }, [
    stopListening,
    append,
    pinnedImageDisplay,
    appendVoiceAlignmentEvent,
    status,
  ]);

  // ── Repeat last examiner message ──
  const handleRepeat = useCallback(() => {
    const lastExaminer = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (!lastExaminer) return;
    const text = getAssistantVoiceText(lastExaminer, assistantVoiceContext);
    if (text) speakTTSSingle(text, { messageId: lastExaminer.id });
  }, [messages, speakTTSSingle, assistantVoiceContext]);

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
    <div className="relative flex h-dvh bg-background">
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

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium">{examConfig.name}</p>
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

          <div className="w-full max-w-3xl mb-4 min-h-[220px] md:min-h-[260px] flex items-center justify-center">
            {/* ─── Audio Player (when exam audio is played) ─── */}
            {showAudioPlayer && pinnedAudioPlayer && (
              <div className="w-full max-w-lg">
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
                  allowPause={pinnedAudioPlayer.allowPause}
                  playbackLocked={aiSpeaking || ttsLoading}
                  autoPlay={shouldAutoPlayCurrentAudio}
                  onPlaybackStateChange={setIsExamAudioPlaying}
                  onComplete={() => {
                    const recordingId = pinnedAudioPlayer.recordingId;
                    if (!recordingId) return;

                    setCompletedExamAudioIds((prev) =>
                      prev.includes(recordingId)
                        ? prev
                        : [...prev, recordingId],
                    );

                    if (handledAudioCompletionRef.current.has(recordingId))
                      return;
                    handledAudioCompletionRef.current.add(recordingId);

                    const completionLocationKey =
                      currentSection && pinnedAudioPlayer.subsection
                        ? `${currentSection}:${pinnedAudioPlayer.subsection}`
                        : null;
                    const isRolePlayPromptSubsection = completionLocationKey
                      ? rolePlaySubsectionLocations.has(completionLocationKey)
                      : false;
                    const completionInstruction = isRolePlayPromptSubsection
                      ? '[System] The exam audio playback has finished. Continue this role-play subsection now: first give a brief role-play introduction, then provide one interlocutor prompt only, and wait for the candidate response.'
                      : '[System] The exam audio playback has finished. Continue with the next step in this subsection.';

                    append({
                      role: 'user',
                      content: completionInstruction,
                    });
                  }}
                />
              </div>
            )}

            {showImageDisplay && pinnedImageDisplay && (
              <div className="w-full max-w-2xl">
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
          </div>

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
        <div className="flex items-center justify-center gap-1 sm:gap-6 px-2 sm:px-4 py-3 border-t">
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

      {/* ─── Transcript panel ─── */}
      <AnimatePresence>
        {showTranscript &&
          (isMobile ? (
            /* On mobile: full-screen overlay */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-30 bg-background"
            >
              <TranscriptPanel
                turns={transcriptTurns}
                onClose={() => setShowTranscript(false)}
                onCopyDebugLog={handleCopyDebugLog}
                isCopyingDebugLog={isCopyingDebugLog}
              />
            </motion.div>
          ) : (
            /* On desktop: side panel */
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
          ))}
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
