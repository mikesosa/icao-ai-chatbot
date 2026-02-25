import { expect } from '@playwright/test';

import {
  getHumanLikeResponseIssue,
  normalizeConversationText,
} from '@/lib/ai/conversation-quality';

export function extractStreamedText(streamPayload: string): string {
  return streamPayload
    .split('\n')
    .filter((line) => line.startsWith('0:'))
    .map((line) => {
      try {
        const parsed = JSON.parse(line.slice(2));
        return typeof parsed === 'string' ? parsed : '';
      } catch {
        return '';
      }
    })
    .join('');
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
