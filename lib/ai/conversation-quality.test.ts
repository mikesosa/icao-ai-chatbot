import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHumanLikeResponseIssue,
  isHumanLikeExamResponse,
  isLikelyIncompleteSentence,
  normalizeConversationText,
} from './conversation-quality';

test('normalizeConversationText collapses repeated whitespace', () => {
  assert.equal(
    normalizeConversationText('Hello   there.\n\nHow are you?'),
    'Hello there. How are you?',
  );
});

test('isLikelyIncompleteSentence detects missing terminal punctuation', () => {
  assert.equal(
    isLikelyIncompleteSentence('Please continue with the next section'),
    true,
  );
});

test('isLikelyIncompleteSentence detects dangling connector endings', () => {
  assert.equal(
    isLikelyIncompleteSentence('Your response is clear and professional, and.'),
    true,
  );
});

test('isLikelyIncompleteSentence accepts complete sentences', () => {
  assert.equal(
    isLikelyIncompleteSentence(
      'Thank you for your answer. Let us continue to the next section.',
    ),
    false,
  );
});

test('getHumanLikeResponseIssue reports empty and short responses', () => {
  assert.equal(getHumanLikeResponseIssue('   '), 'response is empty');
  assert.equal(
    getHumanLikeResponseIssue('Okay.'),
    'response is too short for a natural examiner turn',
  );
});

test('isHumanLikeExamResponse returns true for natural examiner turn', () => {
  assert.equal(
    isHumanLikeExamResponse(
      'Thank you for sharing that. Your answer was clear and relevant.',
    ),
    true,
  );
});
