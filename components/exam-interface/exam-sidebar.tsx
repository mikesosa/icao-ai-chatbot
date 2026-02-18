'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { UseChatHelpers } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { useExamContext } from '@/hooks/use-exam-context';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useSidebar } from '../ui/sidebar';

import type { CompleteExamConfig, ExamSection } from './exam';
import { ExamSectionControls } from './exam-section-controls';
import { ExamTimer } from './exam-timer';

interface ExamSidebarProps {
  examConfig: CompleteExamConfig;
  append?: UseChatHelpers['append'];
}

type MicCheckStatus = 'idle' | 'checking' | 'passed' | 'failed';

function getAudioContextConstructor(): typeof AudioContext | undefined | null {
  if (typeof window === 'undefined') return null;

  const withWebkit = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };

  return window.AudioContext || withWebkit.webkitAudioContext;
}

function formatMicError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Microphone access was blocked. Allow mic access in your browser settings and try again.';
    }

    if (error.name === 'NotFoundError') {
      return 'No microphone was found. Connect a microphone and retry.';
    }

    if (error.name === 'NotReadableError') {
      return 'Microphone is busy in another app. Close other apps using the mic and retry.';
    }
  }

  return 'Unable to verify microphone input. Check browser permissions and retry.';
}

export function ExamSidebar({ examConfig, append }: ExamSidebarProps) {
  // Use exam context state instead of local state
  const { setOpen } = useSidebar();
  const { data: session } = useSession();
  const userType = session?.user?.type || 'guest';
  const _isAdmin = userType === 'admin';
  const allowJump = process.env.NODE_ENV === 'development';

  const {
    examStarted,
    currentSection,
    currentSubsection,
    completedSections,
    completedSubsections,
    setCurrentSection,
    setCurrentSubsection,
    completeSubsection,
    startExam,
    endExam,
    jumpToSection,
    jumpToSubsection,
  } = useExamContext();
  // Note: setExamConfig is called by ChatPageLayout (parent), not here

  // Track last appended subsection to prevent duplicates
  const lastAppendedSubsection = useRef<string | null>(null);
  const [audioCheckOpen, setAudioCheckOpen] = useState(false);
  const [micCheckStatus, setMicCheckStatus] = useState<MicCheckStatus>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakerTonePlayed, setSpeakerTonePlayed] = useState(false);
  const [speakerConfirmed, setSpeakerConfirmed] = useState(false);
  const [speakerError, setSpeakerError] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationFrameRef = useRef<number | null>(null);
  const micCheckRunIdRef = useRef(0);

  // Track subsection changes for potential future use
  useEffect(() => {
    if (
      currentSubsection &&
      lastAppendedSubsection.current !== currentSubsection
    ) {
      lastAppendedSubsection.current = currentSubsection;
    }
  }, [currentSubsection]);

  const cleanupMicCheckResources = useCallback(() => {
    if (micAnimationFrameRef.current !== null) {
      cancelAnimationFrame(micAnimationFrameRef.current);
      micAnimationFrameRef.current = null;
    }

    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    if (micAnalyserRef.current) {
      micAnalyserRef.current.disconnect();
      micAnalyserRef.current = null;
    }

    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }

    if (micAudioContextRef.current) {
      void micAudioContextRef.current.close();
      micAudioContextRef.current = null;
    }
  }, []);

  const resetAudioCheckState = useCallback(() => {
    micCheckRunIdRef.current += 1;
    cleanupMicCheckResources();
    setMicCheckStatus('idle');
    setMicLevel(0);
    setMicError(null);
    setSpeakerTonePlayed(false);
    setSpeakerConfirmed(false);
    setSpeakerError(null);
  }, [cleanupMicCheckResources]);

  useEffect(() => {
    return () => {
      micCheckRunIdRef.current += 1;
      cleanupMicCheckResources();
    };
  }, [cleanupMicCheckResources]);

  // Exam handlers
  const beginExam = useCallback(() => {
    startExam(
      examConfig.id,
      undefined,
      examConfig.controlsConfig.totalSections,
    );
    setCurrentSection('1');
    setCurrentSubsection(null);
    lastAppendedSubsection.current = null; // Reset tracking
    setOpen(false);

    toast.success(`Exam ${examConfig.name} started - Section 1`);
  }, [
    examConfig.controlsConfig.totalSections,
    examConfig.id,
    examConfig.name,
    setCurrentSection,
    setCurrentSubsection,
    setOpen,
    startExam,
  ]);

  const runMicCheck = useCallback(async () => {
    const runId = micCheckRunIdRef.current + 1;
    micCheckRunIdRef.current = runId;

    cleanupMicCheckResources();
    setMicCheckStatus('checking');
    setMicError(null);
    setMicLevel(0);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setMicCheckStatus('failed');
      setMicError('This browser does not support microphone checks.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (micCheckRunIdRef.current !== runId) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      micStreamRef.current = stream;

      const devices = await navigator.mediaDevices
        .enumerateDevices()
        .catch(() => []);
      const hasInputDevice = devices.some(
        (device) => device.kind === 'audioinput',
      );

      if (!hasInputDevice) {
        cleanupMicCheckResources();
        setMicCheckStatus('failed');
        setMicError('No microphone input device was detected.');
        return;
      }

      const AudioContextConstructor = getAudioContextConstructor();
      if (!AudioContextConstructor) {
        cleanupMicCheckResources();
        setMicCheckStatus('passed');
        setMicLevel(1);
        return;
      }

      const audioContext = new AudioContextConstructor();
      micAudioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      micSourceRef.current = source;
      micAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);
      const threshold = 0.02;
      let hasInput = false;
      let peakLevel = 0;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const sample = () => {
          if (micCheckRunIdRef.current !== runId) {
            resolve();
            return;
          }

          analyser.getByteTimeDomainData(dataArray);

          let sumSquares = 0;
          for (const sampleValue of dataArray) {
            const normalizedSample = (sampleValue - 128) / 128;
            sumSquares += normalizedSample * normalizedSample;
          }

          const rms = Math.sqrt(sumSquares / dataArray.length);
          const meterLevel = Math.min(1, rms * 8);
          peakLevel = Math.max(peakLevel, meterLevel);
          setMicLevel(meterLevel);

          if (rms > threshold) {
            hasInput = true;
          }

          if (performance.now() - startTime >= 1800) {
            resolve();
            return;
          }

          micAnimationFrameRef.current = requestAnimationFrame(sample);
        };

        sample();
      });

      if (micCheckRunIdRef.current !== runId) {
        cleanupMicCheckResources();
        return;
      }

      cleanupMicCheckResources();

      if (!hasInput) {
        setMicCheckStatus('failed');
        setMicError(
          'Microphone permission is enabled, but no input was detected. Speak clearly and retry.',
        );
        setMicLevel(Math.max(peakLevel, 0.05));
        return;
      }

      setMicCheckStatus('passed');
      setMicError(null);
      setMicLevel(Math.max(peakLevel, 0.2));
    } catch (error) {
      if (micCheckRunIdRef.current !== runId) {
        return;
      }

      cleanupMicCheckResources();
      setMicCheckStatus('failed');
      setMicError(formatMicError(error));
      setMicLevel(0);
    }
  }, [cleanupMicCheckResources]);

  const playSpeakerTestTone = useCallback(async () => {
    setSpeakerError(null);
    setSpeakerConfirmed(false);

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setSpeakerError('This browser does not support speaker checks.');
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.2,
        audioContext.currentTime + 0.05,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.65,
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.7);
      oscillator.onended = () => {
        void audioContext.close();
      };

      setSpeakerTonePlayed(true);
    } catch (_error) {
      setSpeakerError(
        'Unable to play the test sound. Check browser audio output settings and try again.',
      );
    }
  }, []);

  const handleAudioCheckOpenChange = useCallback(
    (open: boolean) => {
      setAudioCheckOpen(open);
      if (!open) {
        resetAudioCheckState();
      }
    },
    [resetAudioCheckState],
  );

  const handleStartExam = useCallback(() => {
    resetAudioCheckState();
    setAudioCheckOpen(true);
  }, [resetAudioCheckState]);

  const micCheckPassed = micCheckStatus === 'passed';
  const speakerCheckPassed = speakerTonePlayed && speakerConfirmed;
  const canStartExam = micCheckPassed && speakerCheckPassed;

  const handleStartExamAfterAudioCheck = useCallback(() => {
    if (!canStartExam) {
      toast.error('Complete all audio checks before starting the exam.');
      return;
    }

    setAudioCheckOpen(false);
    resetAudioCheckState();
    beginExam();
  }, [beginExam, canStartExam, resetAudioCheckState]);

  const handleSectionChange = (section: ExamSection) => {
    // In development we allow jumping (for debugging) and also notify chat via setOnSectionChange callback.
    if (allowJump) {
      jumpToSection(section.toString());
      toast.info(`[Dev] Jumped to Section ${section}`);
      return;
    }

    // Existing progressive lock logic for regular users
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) =>
      Number.parseInt(s),
    );

    // Progressive lock: Only allow going to completed sections or current section
    if (
      section > currentSectionNum &&
      !completedSectionNums.includes(section)
    ) {
      toast.warning(
        'Complete current section before advancing to future sections',
      );
      return;
    }

    // Real exam behavior: No navigation during active timing
    // Only allow reviewing completed sections
    if (
      section !== currentSectionNum &&
      !completedSectionNums.includes(section)
    ) {
      toast.warning('Section navigation is restricted during the exam');
      return;
    }

    // If navigating to a different completed section, show confirmation
    if (
      section !== currentSectionNum &&
      completedSectionNums.includes(section)
    ) {
      toast.info(`Reviewing completed Section ${section}`);
    }

    setCurrentSection(section.toString());
    setCurrentSubsection(null); // Reset subsection when changing sections

    toast.info(`Changed to Section ${section}`);
  };

  const handleSubsectionChange = (subsectionId: string) => {
    // In development we allow jumping (for debugging) and also notify chat via setOnSectionChange callback.
    if (allowJump) {
      jumpToSubsection(subsectionId);
      toast.info(`[Dev] Jumped to Subsection ${subsectionId}`);
      return;
    }

    // Existing progressive lock logic for regular users
    const currentSectionNum = Number.parseInt(currentSection || '1');
    const completedSectionNums = completedSections.map((s) =>
      Number.parseInt(s),
    );

    // Get the section number from subsection ID (e.g., "2A" -> section 2)
    const subsectionSection = Number.parseInt(subsectionId.charAt(0));

    // Progressive lock: Only allow subsections of completed sections or current section
    if (
      subsectionSection > currentSectionNum &&
      !completedSectionNums.includes(subsectionSection)
    ) {
      toast.warning(
        'Complete current section before accessing future subsections',
      );
      return;
    }

    // Real exam behavior: Only allow subsections within current or completed sections
    if (
      subsectionSection !== currentSectionNum &&
      !completedSectionNums.includes(subsectionSection)
    ) {
      toast.warning('Subsection navigation is restricted during the exam');
      return;
    }

    // Set subsection first to prevent auto-selection race condition
    setCurrentSubsection(subsectionId);

    // If navigating to a subsection of a different section, switch sections after
    if (subsectionSection !== currentSectionNum) {
      setCurrentSection(subsectionSection.toString());
    }

    // Track subsection change
    if (lastAppendedSubsection.current !== subsectionId) {
      lastAppendedSubsection.current = subsectionId;
    }

    toast.info(`Changed to Subsection ${subsectionId}`);
  };

  const handleEndExamRequest = (opts: { generateReport: boolean }) => {
    const total = examConfig.controlsConfig.totalSections;
    const done = completedSections.length;
    const endedEarly = done < total;

    // Request a partial evaluation before ending exam UI state
    if (opts.generateReport) {
      const examName = examConfig.name || 'exam';
      const evaluatorInstruction = endedEarly
        ? `[System] The candidate has ended the ${examName} early, before all parts were completed. Provide a PARTIAL evaluation based only on observed performance so far. Clearly label it as INCOMPLETE / ENDED EARLY and do not assume completion of missing parts.`
        : `[System] The candidate has finished the ${examName}. If exam completion has not yet been triggered, call examSectionControl(action: "complete_exam"), then provide the final evaluation based on observed performance.`;

      // Use the chat append function if available (passed down from ChatPageLayout)
      if (append) {
        append({ role: 'user', content: evaluatorInstruction });
      } else {
        toast.warning(
          'Could not request evaluation report (chat not ready). Ending exam anyway.',
        );
      }
    }

    endExam();
    toast.success(
      opts.generateReport
        ? endedEarly
          ? 'Exam ended early — generating partial report...'
          : 'Exam completed — generating report...'
        : endedEarly
          ? 'Exam ended (no report generated)'
          : 'Exam completed successfully!',
    );
  };

  const handleSectionComplete = (section: ExamSection) => {
    completeSubsection(section.toString());
    toast.info(`Section ${section} completed`);
  };

  const handleTimerWarning = (section: ExamSection, timeLeft: number) => {
    toast.warning(
      `Section ${section}: Only ${Math.floor(timeLeft / 60)} minutes left`,
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AlertDialog
        open={audioCheckOpen}
        onOpenChange={handleAudioCheckOpenChange}
      >
        <AlertDialogContent data-testid="audio-settings-check-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Check Audio Settings</AlertDialogTitle>
            <AlertDialogDescription>
              Before starting the test, confirm your microphone and
              speakers/headphones are working. If Chrome blocks microphone
              access, allow it in the site permission prompt and retry.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  1. Verify microphone detection and input
                </p>
                <Badge variant={micCheckPassed ? 'default' : 'outline'}>
                  {micCheckPassed
                    ? 'Passed'
                    : micCheckStatus === 'checking'
                      ? 'Checking...'
                      : 'Required'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the button, allow mic permission, then speak for about 2
                seconds.
              </p>
              <div className="h-2 w-full rounded bg-muted">
                <div
                  className="h-2 rounded bg-primary transition-all"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
              {micError && (
                <p className="text-xs text-destructive">{micError}</p>
              )}
              <Button
                type="button"
                variant={micCheckPassed ? 'outline' : 'default'}
                onClick={runMicCheck}
                disabled={micCheckStatus === 'checking'}
                data-testid="audio-settings-check-mic"
              >
                {micCheckStatus === 'checking'
                  ? 'Checking Microphone...'
                  : micCheckPassed
                    ? 'Re-check Microphone'
                    : 'Check Microphone'}
              </Button>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  2. Verify speakers or headphones
                </p>
                <Badge variant={speakerCheckPassed ? 'default' : 'outline'}>
                  {speakerCheckPassed ? 'Passed' : 'Required'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Play the test sound, then confirm you can hear it.
              </p>
              {speakerError && (
                <p className="text-xs text-destructive">{speakerError}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={playSpeakerTestTone}
                  data-testid="audio-settings-check-speaker"
                >
                  {speakerTonePlayed
                    ? 'Play Test Sound Again'
                    : 'Play Test Sound'}
                </Button>
                <Button
                  type="button"
                  variant={speakerConfirmed ? 'default' : 'outline'}
                  onClick={() => setSpeakerConfirmed(true)}
                  disabled={!speakerTonePlayed}
                  data-testid="audio-settings-check-heard"
                >
                  I Can Hear It
                </Button>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="audio-settings-check-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartExamAfterAudioCheck}
              disabled={!canStartExam}
              data-testid="audio-settings-check-start"
            >
              Start Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {examStarted && (
        <ExamTimer
          currentSection={Number.parseInt(currentSection || '1') as ExamSection}
          examConfig={examConfig.examConfig}
          onSectionComplete={handleSectionComplete}
          onTimerWarning={handleTimerWarning}
        />
      )}

      <ExamSectionControls
        currentSection={Number.parseInt(currentSection || '1') as ExamSection}
        currentSubsection={currentSubsection}
        completedSections={
          completedSections.map((s) => Number.parseInt(s)) as ExamSection[]
        }
        completedSubsections={completedSubsections}
        onSectionChange={handleSectionChange}
        onSubsectionChange={handleSubsectionChange}
        onStartExam={handleStartExam}
        onEndExamRequest={handleEndExamRequest}
        examStarted={examStarted}
        controlsConfig={examConfig.controlsConfig}
        examConfig={examConfig}
      />
    </div>
  );
}
