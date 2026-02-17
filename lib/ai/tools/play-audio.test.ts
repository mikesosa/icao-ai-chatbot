import assert from 'node:assert/strict';
import test from 'node:test';

import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';

import { getExamTypeFromConfig, resolveElpacExamRouting } from './play-audio';

const elpacDemoConfig = (examConfigsData as any)['elpac-demo'];

test('getExamTypeFromConfig resolves demo exam type', () => {
  assert.equal(getExamTypeFromConfig({ id: 'elpac-demo' }), 'elpac');
  assert.equal(getExamTypeFromConfig({ id: 'tea-evaluator' }), 'tea');
});

test('resolveElpacExamRouting maps 1P1 to Paper 1 recording mode', () => {
  const result = resolveElpacExamRouting({
    subsection: '1P1',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.examSection, '1');
  assert.equal(result.mode, 'recording');
  assert.equal(result.recordingNumber, 1);
});

test('resolveElpacExamRouting supports legacy Paper 1 calls without subsection', () => {
  const result = resolveElpacExamRouting({
    recordingNumber: 4,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.examSection, '1');
  assert.equal(result.mode, 'recording');
  assert.equal(result.recordingNumber, 4);
});

test('resolveElpacExamRouting maps 1P3 to configured recording number', () => {
  const result = resolveElpacExamRouting({
    subsection: '1P3',
    recordingNumber: 2,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.examSection, '1');
  assert.equal(result.mode, 'recording');
  assert.equal(result.recordingNumber, 2);
});

test('resolveElpacExamRouting rejects invalid subsection/recording combos', () => {
  const result = resolveElpacExamRouting({
    subsection: '1P3',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.error, /1P3 must use recording 2/i);
});

test('resolveElpacExamRouting maps 2I to Paper 2 prompt mode', () => {
  const result = resolveElpacExamRouting({
    subsection: '2I',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.examSection, '2');
  assert.equal(result.mode, 'prompt');
  assert.equal(result.recordingNumber, 1);
});

test('resolveElpacExamRouting rejects playAudio usage for visual tasks', () => {
  const result = resolveElpacExamRouting({
    subsection: '2II',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.error, /do not support playAudio/i);
});
