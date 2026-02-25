import { expect } from '@playwright/test';

import {
  getHumanLikeResponseIssue,
  normalizeConversationText,
} from '@/lib/ai/conversation-quality';

export function extractStreamedText(streamPayload: string): string {
  const lines = streamPayload.split('\n').filter(Boolean);
  const chunks: string[] = [];

  const parseMessageText = (messageLike: unknown): string => {
    if (!messageLike || typeof messageLike !== 'object') {
      return '';
    }

    const parts = (messageLike as any).parts;
    if (!Array.isArray(parts)) {
      return '';
    }

    return parts
      .filter(
        (part: any) => part?.type === 'text' && typeof part.text === 'string',
      )
      .map((part: any) => part.text)
      .join('');
  };

  const extractAppendMessageText = (value: unknown): string => {
    if (!value) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.map((item) => extractAppendMessageText(item)).join('');
    }

    if (typeof value !== 'object') {
      return '';
    }

    const payload = value as any;
    let directText = '';

    if (
      payload.type === 'append-message' &&
      typeof payload.message === 'string'
    ) {
      try {
        const parsedMessage = JSON.parse(payload.message);
        directText += parseMessageText(parsedMessage);
      } catch {
        // Ignore malformed append-message payloads in the stream parser.
      }
    }

    for (const nestedValue of Object.values(payload)) {
      directText += extractAppendMessageText(nestedValue);
    }

    return directText;
  };

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const channel = line.slice(0, separatorIndex);
    const payload = line.slice(separatorIndex + 1);

    try {
      const parsed = JSON.parse(payload);
      if (channel === '0' && typeof parsed === 'string') {
        chunks.push(parsed);
        continue;
      }

      const appendMessageText = extractAppendMessageText(parsed);
      if (appendMessageText) {
        chunks.push(appendMessageText);
      }
    } catch {
      // Ignore non-JSON lines in streamed payload parsing.
    }
  }

  return chunks.join('');
}

export function normalizeText(text: string): string {
  return normalizeConversationText(text);
}

export function assertHumanLikeExamResponse(
  text: string,
  label = 'exam response',
) {
  const normalized = normalizeText(text);
  const issue = getHumanLikeResponseIssue(normalized);

  expect(normalized, `${label} should not be empty`).not.toBe('');
  expect(issue, `${label}: ${issue ?? 'ok'}; text="${normalized}"`).toBeNull();
}
