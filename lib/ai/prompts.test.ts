import assert from 'node:assert/strict';
import test from 'node:test';

import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';

import { buildExamEvaluatorPrompt, systemPrompt } from './prompts';

const elpacDemoConfig = (examConfigsData as any)['elpac-demo'];

test('buildExamEvaluatorPrompt includes current subsection context when provided', () => {
  const prompt = buildExamEvaluatorPrompt(elpacDemoConfig, '1', '1P3');

  assert.match(prompt, /CURRENT SUBSECTION CONTEXT/i);
  assert.match(prompt, /subsection 1P3/i);
  assert.match(prompt, /Part 3 - SAQ Non-routine \(Demo\)/i);
});

test('systemPrompt propagates subsection context for exam models', () => {
  const prompt = systemPrompt({
    selectedChatModel: 'elpac-demo',
    requestHints: {
      latitude: '0',
      longitude: '0',
      city: 'Test City',
      country: 'Test Country',
    },
    examConfig: elpacDemoConfig,
    currentSection: '2',
    currentSubsection: '2I',
  });

  assert.match(prompt, /CURRENT SUBSECTION CONTEXT/i);
  assert.match(prompt, /subsection 2I/i);
});

test('exam general prompt no longer references unsupported complete_and_advance action', () => {
  const prompt = buildExamEvaluatorPrompt(elpacDemoConfig);

  assert.doesNotMatch(prompt, /complete_and_advance/);
  assert.match(prompt, /advance_to_next/);
});
