import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateExamTopicGuard } from './exam-topic-guard';

test('blocks explicit off-topic requests during exam', () => {
  const result = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText: 'Can you tell me a joke about cats?',
  });

  assert.equal(result.blocked, true);
  assert.match(result.redirectMessage ?? '', /Section 2, Subsection 2II/i);
});

test('allows short alphanumeric exam answers', () => {
  const result = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '1',
    currentSubsection: '1P1',
    latestUserText: '6142',
  });

  assert.equal(result.blocked, false);
});

test('blocks low-signal or irrelevant replies in listening prompts', () => {
  const lowSignalResult = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '1',
    currentSubsection: '1P3',
    latestUserText: 'yes',
  });

  const irrelevantResult = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '1',
    currentSubsection: '1P1',
    latestUserText: 'after surgery',
  });

  assert.equal(lowSignalResult.blocked, true);
  assert.equal(irrelevantResult.blocked, true);
});

test('allows aviation-related answers', () => {
  const result = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '1',
    currentSubsection: '1P3',
    latestUserText:
      'The crew requested immediate return and priority landing due to smoke in the cabin.',
  });

  assert.equal(result.blocked, false);
});

test('blocks refusal or non-exam utterances in role play sections', () => {
  const result = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText: "no way don't give me instructions",
  });

  assert.equal(result.blocked, true);
  assert.match(result.redirectMessage ?? '', /Section 2, Subsection 2II/i);
});

test('allows exam control and completion messages', () => {
  const systemResult = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText:
      '[System] Finalize the ELPAC ATC Demo now. Provide the final evaluation and clearly state that the demo is complete.',
  });

  const completionResult = evaluateExamTopicGuard({
    isExamModel: true,
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText:
      'I have completed all parts of this ELPAC demo. Please provide the final evaluation and conclude the exam now.',
  });

  assert.equal(systemResult.blocked, false);
  assert.equal(completionResult.blocked, false);
});
