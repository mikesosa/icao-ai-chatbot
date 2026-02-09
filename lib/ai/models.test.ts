import {
  type CoreMessage,
  type LanguageModelV1StreamPart,
  simulateReadableStream,
} from 'ai';
import { MockLanguageModelV1 } from 'ai/test';

const DEFAULT_USAGE = { promptTokens: 10, completionTokens: 20 } as const;

const finishChunk = (): LanguageModelV1StreamPart => ({
  type: 'finish',
  finishReason: 'stop',
  logprobs: undefined,
  usage: { completionTokens: 10, promptTokens: 3 },
});

const textToDeltas = (text: string): LanguageModelV1StreamPart[] =>
  text
    .split(' ')
    .filter(Boolean)
    .map((word) => ({
      type: 'text-delta' as const,
      textDelta: `${word} `,
    }));

const reasoningToDeltas = (text: string): LanguageModelV1StreamPart[] =>
  text
    .split(' ')
    .filter(Boolean)
    .map((word) => ({
      type: 'reasoning' as const,
      textDelta: `${word} `,
    }));

const toText = (message: CoreMessage): string => {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return '';
  }

  return message.content
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join(' ')
    .trim();
};

const getLastUserText = (prompt: CoreMessage[]): string => {
  for (let index = prompt.length - 1; index >= 0; index--) {
    const message = prompt[index];
    if (message.role !== 'user') {
      continue;
    }

    const text = toText(message);
    if (text) {
      return text;
    }
  }

  return '';
};

const createTextResponse = (text: string): LanguageModelV1StreamPart[] => [
  ...textToDeltas(text),
  finishChunk(),
];

const getGeneralResponseChunks = (
  prompt: CoreMessage[],
  isReasoningEnabled = false,
): LanguageModelV1StreamPart[] => {
  const lastUserText = getLastUserText(prompt).toLowerCase();

  if (lastUserText.includes('why is the sky blue')) {
    if (isReasoningEnabled) {
      return [
        ...reasoningToDeltas(
          'The sky is blue because of Rayleigh scattering in the atmosphere.',
        ),
        ...textToDeltas("It's just blue duh!"),
        finishChunk(),
      ];
    }

    return createTextResponse("It's just blue duh!");
  }

  if (lastUserText.includes('why is grass green')) {
    if (isReasoningEnabled) {
      return [
        ...reasoningToDeltas(
          'Grass looks green because chlorophyll absorbs red and blue light.',
        ),
        ...textToDeltas("It's just green duh!"),
        finishChunk(),
      ];
    }

    return createTextResponse("It's just green duh!");
  }

  if (lastUserText.includes('what are the advantages of using next.js')) {
    return createTextResponse('With Next.js, you can ship fast!');
  }

  if (lastUserText.includes('who painted this')) {
    return createTextResponse('This painting is by Monet!');
  }

  if (lastUserText.includes("what's the weather in sf")) {
    return createTextResponse(
      'The current temperature in San Francisco is 17°C.',
    );
  }

  if (lastUserText.includes('thanks')) {
    return createTextResponse("You're welcome!");
  }

  return createTextResponse('Unknown test prompt!');
};

const getExamResponseChunks = (
  prompt: CoreMessage[],
): LanguageModelV1StreamPart[] => {
  const lastUserText = getLastUserText(prompt).toLowerCase();

  if (lastUserText.includes('start the evaluation')) {
    return createTextResponse(
      "Welcome to the TEA Demo. Let's begin with Section 1. Tell me briefly about your current role in aviation.",
    );
  }

  if (lastUserText.includes('i want to finish the exam now')) {
    return createTextResponse(
      'Thank you. I have evaluated your final response. This TEA Demo is now complete.',
    );
  }

  return createTextResponse('Thank you. Please continue.');
};

const createStreamingModel = (
  chunkFactory: (prompt: CoreMessage[]) => LanguageModelV1StreamPart[],
) =>
  new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: DEFAULT_USAGE,
      text: 'Hello, world!',
    }),
    doStream: async ({ prompt }: { prompt: CoreMessage[] }) => ({
      stream: simulateReadableStream({
        chunkDelayInMs: 10,
        initialDelayInMs: 20,
        chunks: chunkFactory(prompt),
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });

export const chatModel = createStreamingModel((prompt) =>
  getGeneralResponseChunks(prompt),
);

export const reasoningModel = createStreamingModel((prompt) =>
  getGeneralResponseChunks(prompt, true),
);

export const titleModel = new MockLanguageModelV1({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: DEFAULT_USAGE,
    text: 'This is a test title',
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 10,
      initialDelayInMs: 20,
      chunks: [
        { type: 'text-delta', textDelta: 'This is a test title' },
        finishChunk(),
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const artifactModel = createStreamingModel((prompt) =>
  getGeneralResponseChunks(prompt),
);

const examModel = createStreamingModel((prompt) =>
  getExamResponseChunks(prompt),
);

export const teaEvaluatorModel = examModel;
export const elpacEvaluatorModel = examModel;
