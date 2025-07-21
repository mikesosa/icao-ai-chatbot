'use client';

import { useEffect, useRef } from 'react';

import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useExamContext } from '@/hooks/use-exam-context';
import type { Suggestion } from '@/lib/db/schema';

import { type ArtifactKind, artifactDefinitions } from './artifact';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'code-delta'
    | 'sheet-delta'
    | 'image-delta'
    | 'title'
    | 'id'
    | 'suggestion'
    | 'clear'
    | 'finish'
    | 'kind'
    | 'exam-section-control'
    | 'audio-player';
  content: string | Suggestion | ExamSectionControlResult | any;
};

type ExamSectionControlResult = {
  type: 'exam-section-control';
  action:
    | 'advance_to_next'
    | 'complete_and_advance'
    | 'complete_current'
    | 'advance_to_section'
    | 'complete_exam';
  targetSection: string | null;
  reason: string;
  timestamp: string;
};

export function DataStreamHandler({
  id: _id,
  dataStream,
}: {
  id: string;
  dataStream?: any[];
}) {
  const { artifact, setArtifact, setMetadata } = useArtifact();
  const { handleAIExamControl } = useExamContext();
  const lastProcessedIndex = useRef(-1);
  // Add a ref to track last processed audio-player recordingId and timestamp
  const lastAudioPlayer = useRef<{
    recordingId: string | null;
    timestamp: number;
  }>({ recordingId: null, timestamp: 0 });

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      console.log('📡 [DATA STREAM] Processing delta:', delta);

      // Handle exam section control events
      if (delta.type === 'exam-section-control') {
        const examControl = delta.content as ExamSectionControlResult;
        console.log(
          '📡 [DATA STREAM] Processing exam section control:',
          examControl,
        );

        handleAIExamControl(
          examControl.action,
          examControl.targetSection || undefined,
        );
        return; // Early return for exam control events
      }

      // Handle audio player events
      if (delta.type === 'audio-player') {
        // Prevent duplicate playAudio tool calls for the same recordingId within 2 seconds
        const now = Date.now();
        const recordingId = delta.content?.recordingId;
        if (
          recordingId &&
          lastAudioPlayer.current.recordingId === recordingId &&
          now - lastAudioPlayer.current.timestamp < 2000
        ) {
          console.warn(
            '⏩ [DATA STREAM] Skipping duplicate audio-player event:',
            recordingId,
          );
          return;
        }
        lastAudioPlayer.current = { recordingId, timestamp: now };
        console.log(
          '🎵 [DATA STREAM] Processing audio player data:',
          delta.content,
        );
        // Audio player data is handled by the message component
        return; // Early return for audio player events
      }

      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'id':
            return {
              ...draftArtifact,
              documentId: delta.content as string,
              status: 'streaming',
            };

          case 'title':
            return {
              ...draftArtifact,
              title: delta.content as string,
              status: 'streaming',
            };

          case 'kind':
            return {
              ...draftArtifact,
              kind: delta.content as ArtifactKind,
              status: 'streaming',
            };

          case 'clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact, handleAIExamControl]);

  return null;
}
