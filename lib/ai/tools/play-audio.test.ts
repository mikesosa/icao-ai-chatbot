import assert from 'node:assert/strict';
import test from 'node:test';

import examConfigsData from '@/app/(chat)/api/exam-configs/exam-configs.json';

import {
  getExamTypeFromConfig,
  resolveExamAudioRouting,
  resolvePlaybackPolicy,
} from './play-audio';

const teaDemoConfig = (examConfigsData as any)['tea-demo'];
const elpacDemoConfig = (examConfigsData as any)['elpac-demo'];

test('getExamTypeFromConfig resolves demo exam type', () => {
  assert.equal(getExamTypeFromConfig({ id: 'elpac-demo' }), 'elpac');
  assert.equal(getExamTypeFromConfig({ id: 'tea-evaluator' }), 'tea');
});

test('resolveExamAudioRouting maps TEA subsection 2B to subsection-based API routing', () => {
  const result = resolveExamAudioRouting({
    subsection: '2B',
    recordingNumber: 1,
    examConfig: teaDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.apiSection, '2b');
  assert.equal(result.recordingNumber, 1);
  assert.equal(result.sourceType, 'subsection-audio');
});

test('resolveExamAudioRouting maps ELPAC 1P1 to section-based API routing', () => {
  const result = resolveExamAudioRouting({
    subsection: '1P1',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.sectionKey, '1');
  assert.equal(result.apiSection, '1');
  assert.equal(result.recordingNumber, 1);
  assert.equal(result.sourceType, 'subsection-audio');
});

test('resolveExamAudioRouting maps ELPAC 2I to section speaking prompts from config', () => {
  const result = resolveExamAudioRouting({
    subsection: '2I',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.sectionKey, '2');
  assert.equal(result.apiSection, '2');
  assert.equal(result.recordingNumber, 1);
  assert.equal(result.sourceType, 'speaking-prompt');
});

test('resolveExamAudioRouting rejects visual subsection without playable audio', () => {
  const result = resolveExamAudioRouting({
    subsection: '2II',
    recordingNumber: 1,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.error, /does not define playable audio/i);
});

test('resolveExamAudioRouting falls back to configured default section when subsection is omitted', () => {
  const result = resolveExamAudioRouting({
    recordingNumber: 2,
    examConfig: elpacDemoConfig,
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.sectionKey, '1');
  assert.equal(result.apiSection, '1');
  assert.equal(result.recordingNumber, 2);
});

test('resolvePlaybackPolicy uses config for ELPAC demo exam audio', () => {
  const policy = resolvePlaybackPolicy({
    isExamRecording: true,
    examConfig: elpacDemoConfig,
  });

  assert.equal(policy.allowSeek, false);
  assert.equal(policy.allowPause, false);
  assert.equal(policy.maxReplays, 0);
});

test('resolvePlaybackPolicy uses config for TEA demo exam audio', () => {
  const policy = resolvePlaybackPolicy({
    isExamRecording: true,
    examConfig: teaDemoConfig,
  });

  assert.equal(policy.allowSeek, false);
  assert.equal(policy.allowPause, true);
  assert.equal(policy.maxReplays, 1);
});
