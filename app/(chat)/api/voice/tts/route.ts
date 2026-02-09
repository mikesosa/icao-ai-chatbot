import type { NextRequest } from 'next/server';

import OpenAI from 'openai';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import {
  DEFAULT_OPENAI_TTS_MODEL,
  DEFAULT_OPENAI_TTS_VOICE,
  OPENAI_TTS_VOICES,
} from '@/lib/voice/openai';

export const runtime = 'nodejs';

const requestSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(OPENAI_TTS_VOICES).optional(),
  instructions: z.string().max(1024).optional(),
});

const LEGACY_TTS_VOICES = new Set([
  'alloy',
  'echo',
  'fable',
  'nova',
  'onyx',
  'shimmer',
]);

function normalizeVoiceForModel(model: string, voice: string) {
  if (
    (model === 'tts-1' || model === 'tts-1-hd') &&
    !LEGACY_TTS_VOICES.has(voice)
  ) {
    return 'alloy';
  }
  return voice;
}

async function synthesizeSpeech(options: {
  client: OpenAI;
  model: string;
  voice: string;
  input: string;
  instructions?: string;
}) {
  const params: Record<string, unknown> = {
    model: options.model,
    voice: normalizeVoiceForModel(options.model, options.voice),
    input: options.input,
    response_format: 'mp3',
  };

  // gpt-4o-mini-tts supports an `instructions` field for controlling tone
  if (options.instructions && options.model === 'gpt-4o-mini-tts') {
    params.instructions = options.instructions;
  }

  const speech = await options.client.audio.speech.create(params as any);
  return speech.arrayBuffer();
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const client = new OpenAI({ apiKey });

  try {
    const body = requestSchema.parse(await req.json());
    const primaryModel =
      process.env.OPENAI_TTS_MODEL ?? DEFAULT_OPENAI_TTS_MODEL;
    const selectedVoice = body.voice ?? DEFAULT_OPENAI_TTS_VOICE;

    // Use a consistent voice instruction to prevent tone shifts across sentence chunks
    const defaultInstructions =
      'Speak in a calm, professional, and steady tone throughout. ' +
      'Maintain consistent vocal energy, pacing, and pitch. ' +
      'Do not add dramatic pauses or change emotion between sentences. ' +
      'Read numbered items naturally (e.g. "1." as "one", "2." as "two").';
    const instructions = body.instructions || defaultInstructions;

    let audioBuffer: ArrayBuffer;
    let resolvedModel = primaryModel;
    try {
      audioBuffer = await synthesizeSpeech({
        client,
        model: primaryModel,
        voice: selectedVoice,
        input: body.text,
        instructions,
      });
    } catch (err) {
      // If model access is restricted, fallback once to tts-1 for compatibility.
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      const canFallback =
        primaryModel !== 'tts-1' &&
        (message.includes('model') ||
          message.includes('not found') ||
          message.includes('does not exist') ||
          message.includes('access'));
      if (!canFallback) throw err;
      resolvedModel = 'tts-1';
      audioBuffer = await synthesizeSpeech({
        client,
        model: resolvedModel,
        voice: selectedVoice,
        input: body.text,
      });
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-TTS-Model': resolvedModel,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: err.issues[0]?.message ?? 'Invalid TTS request',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    if (err instanceof OpenAI.APIError) {
      return new Response(
        JSON.stringify({ error: `OpenAI TTS API error: ${err.message}` }),
        {
          status: err.status ?? 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    if (err instanceof Error) {
      return new Response(
        JSON.stringify({
          error: `OpenAI TTS connection error: ${err.message}`,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    return new Response(
      JSON.stringify({ error: 'Failed to synthesize OpenAI speech' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
