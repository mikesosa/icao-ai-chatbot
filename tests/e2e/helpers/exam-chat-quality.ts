import { expect } from '@playwright/test';

import {
  getHumanLikeResponseIssue,
  normalizeConversationText,
} from '@/lib/ai/conversation-quality';

export type ParsedStreamAppendMessage = {
  id?: string;
  role?: string;
  text: string;
  raw: unknown;
};

export type ParsedStreamDataEvent = {
  type: string;
  content?: unknown;
  channel: string;
};

export type ParsedStreamPayload = {
  text: string;
  appendMessages: ParsedStreamAppendMessage[];
  dataEvents: ParsedStreamDataEvent[];
  parsedLineCount: number;
};

function parseMessageText(messageLike: unknown): string {
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
}

function collectStreamObjects(value: unknown, collector: unknown[]) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStreamObjects(item, collector);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  collector.push(value);

  for (const nestedValue of Object.values(value)) {
    collectStreamObjects(nestedValue, collector);
  }
}

export function parseStreamPayload(streamPayload: string): ParsedStreamPayload {
  const lines = streamPayload.split('\n').filter(Boolean);
  const chunks: string[] = [];
  const appendMessages: ParsedStreamAppendMessage[] = [];
  const dataEvents: ParsedStreamDataEvent[] = [];
  let parsedLineCount = 0;

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const channel = line.slice(0, separatorIndex);
    const payload = line.slice(separatorIndex + 1);

    try {
      const parsed = JSON.parse(payload);
      parsedLineCount += 1;

      if (channel === '0' && typeof parsed === 'string') {
        chunks.push(parsed);
      }

      const streamObjects: unknown[] = [];
      collectStreamObjects(parsed, streamObjects);

      for (const candidate of streamObjects) {
        if (!candidate || typeof candidate !== 'object') {
          continue;
        }

        const payloadObject = candidate as any;

        if (
          payloadObject.type === 'append-message' &&
          typeof payloadObject.message === 'string'
        ) {
          try {
            const parsedMessage = JSON.parse(payloadObject.message);
            const parsedMessageText = parseMessageText(parsedMessage);
            if (parsedMessageText) {
              chunks.push(parsedMessageText);
            }
            appendMessages.push({
              id:
                typeof parsedMessage?.id === 'string'
                  ? parsedMessage.id
                  : undefined,
              role:
                typeof parsedMessage?.role === 'string'
                  ? parsedMessage.role
                  : undefined,
              text: parsedMessageText,
              raw: parsedMessage,
            });
          } catch {
            // Ignore malformed append-message payloads in the stream parser.
          }
        }

        if (
          typeof payloadObject.type === 'string' &&
          payloadObject.type !== 'append-message'
        ) {
          dataEvents.push({
            type: payloadObject.type,
            content: payloadObject.content,
            channel,
          });
        }
      }
    } catch {
      // Ignore non-JSON lines in streamed payload parsing.
    }
  }

  return {
    text: chunks.join(''),
    appendMessages,
    dataEvents,
    parsedLineCount,
  };
}

export function extractStreamedText(streamPayload: string): string {
  return parseStreamPayload(streamPayload).text;
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
