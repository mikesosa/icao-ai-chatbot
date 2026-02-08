export const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const;

export type OpenAITTSVoice = (typeof OPENAI_TTS_VOICES)[number];

export const DEFAULT_OPENAI_TTS_VOICE: OpenAITTSVoice = 'alloy';
export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';

export function isOpenAIVoice(value: string): value is OpenAITTSVoice {
  return (OPENAI_TTS_VOICES as readonly string[]).includes(value);
}
