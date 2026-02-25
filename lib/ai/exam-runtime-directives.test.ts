import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExamRuntimeDirective,
  hasExplicitExamCompletionIntent,
  isLikelySubstantiveListeningAnswer,
} from './exam-runtime-directives';

test('detects explicit exam completion intents', () => {
  assert.equal(
    hasExplicitExamCompletionIntent(
      'I have completed all parts. Please provide the final evaluation and conclude the exam now.',
    ),
    true,
  );
  assert.equal(
    hasExplicitExamCompletionIntent('Please continue with the task.'),
    false,
  );
  assert.equal(
    hasExplicitExamCompletionIntent(
      '[System] Finalize the ELPAC ATC Demo now. Provide the final evaluation and clearly state that the demo is complete.',
    ),
    true,
  );
});

test('listening answer detection ignores playback-meta only messages', () => {
  assert.equal(isLikelySubstantiveListeningAnswer('Press Play.'), false);
  assert.equal(isLikelySubstantiveListeningAnswer('Ready.'), false);
  assert.equal(
    isLikelySubstantiveListeningAnswer(
      'The assigned transponder code is six one four two.',
    ),
    true,
  );
});

test('buildExamRuntimeDirective adds completion and listening directives for elpac demo', () => {
  const completionDirective = buildExamRuntimeDirective({
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText:
      'I have completed all parts of this ELPAC demo. Please provide the final evaluation and conclude the exam now.',
  });
  assert.match(completionDirective ?? '', /complete_exam/i);
  assert.match(
    completionDirective ?? '',
    /This ELPAC ATC Demo is now complete\./i,
  );

  const listeningDirective = buildExamRuntimeDirective({
    selectedChatModel: 'elpac-demo',
    currentSection: '1',
    currentSubsection: '1P3',
    latestUserText:
      'The crew requested immediate return and priority landing due to smoke in the cabin.',
  });
  assert.match(
    listeningDirective ?? '',
    /do not output "Press Play to listen"/i,
  );

  const nonElpacDirective = buildExamRuntimeDirective({
    selectedChatModel: 'tea-demo',
    currentSection: '2',
    currentSubsection: '2C',
    latestUserText: 'Please finish now.',
  });
  assert.equal(nonElpacDirective, null);
});

test('buildExamRuntimeDirective adds role-play and visual-flow guardrails for elpac section 2', () => {
  const rolePlayDirective = buildExamRuntimeDirective({
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2I',
    latestUserText: 'Falcon nine zero six, startup approved.',
  });
  assert.match(
    rolePlayDirective ?? '',
    /Do not prefix any utterance with "Pilot:"/i,
  );

  const visualDirective = buildExamRuntimeDirective({
    selectedChatModel: 'elpac-demo',
    currentSection: '2',
    currentSubsection: '2II',
    latestUserText:
      'The image shows an operational airport communication environment.',
  });
  assert.match(
    visualDirective ?? '',
    /ask exactly one prompt\/question per examiner turn/i,
  );
  assert.match(
    visualDirective ?? '',
    /Never output both "Please describe what you see\." and "Describe the operational situation you see\."/i,
  );
});
