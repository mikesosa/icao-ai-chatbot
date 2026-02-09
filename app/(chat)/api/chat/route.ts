import { after } from 'next/server';

import { geolocation } from '@vercel/functions';
import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from 'ai';
import { differenceInSeconds } from 'date-fns';
import {
  type ResumableStreamContext,
  createResumableStreamContext,
} from 'resumable-stream';

import { type UserType, auth } from '@/app/(auth)/auth';
import type { SerializedCompleteExamConfig } from '@/components/exam-interface/exam';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  type RequestHints,
  isExamEvaluator,
  systemPrompt,
} from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { createDocument } from '@/lib/ai/tools/create-document';
import { displayImageTool } from '@/lib/ai/tools/display-image';
import { examSectionControl } from '@/lib/ai/tools/exam-section-control';
import { getAudioTranscript } from '@/lib/ai/tools/get-audio-transcript';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { playAudioTool } from '@/lib/ai/tools/play-audio';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { isActiveSubscriptionStatus } from '@/lib/billing/subscription';
import { isProductionEnvironment } from '@/lib/constants';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  getSubscriptionByUserId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import type { Chat } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import examConfigsData from '../exam-configs/exam-configs.json';

import { type PostRequestBody, postRequestBodySchema } from './schema';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.log(
        ' > Resumable streams are disabled: REDIS_URL not configured',
      );
      return null;
    }

    try {
      new URL(redisUrl);
    } catch {
      console.log(
        ' > Resumable streams are disabled: REDIS_URL has invalid format',
      );
      return null;
    }

    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else if (
        error.code === 'ERR_INVALID_URL' ||
        error.message.includes('Invalid URL')
      ) {
        console.log(
          ' > Resumable streams are disabled due to invalid REDIS_URL configuration',
        );
      } else {
        console.log(
          ' > Resumable streams are disabled due to configuration error:',
          error.message,
        );
        console.error(error);
      }
      globalStreamContext = null;
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      modelType,
      currentSection: requestCurrentSection,
      currentSubsection: requestCurrentSubsection,
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    const maxMessages = entitlementsByUserType[userType].maxMessagesPerDay;
    console.log(
      `🚦 [RATE LIMIT] User ${session.user.id} (${userType}): ${messageCount}/${maxMessages === -1 ? '∞' : maxMessages} messages in last 24h`,
    );

    if (maxMessages !== -1 && messageCount > maxMessages) {
      console.log(
        `❌ [RATE LIMIT] User ${session.user.id} exceeded limit: ${messageCount} > ${maxMessages}`,
      );
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    if (isExamEvaluator(selectedChatModel)) {
      const subscription = await getSubscriptionByUserId(session.user.id);
      const isActive = isActiveSubscriptionStatus(subscription?.status);

      if (!isActive) {
        return new ChatSDKError('payment_required:billing').toResponse();
      }
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
        modelType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    // Load exam configuration if this is an exam evaluator model
    let examConfig: SerializedCompleteExamConfig | undefined;
    let currentSection: string | undefined;

    if (isExamEvaluator(selectedChatModel)) {
      try {
        // Load exam config from imported data
        const examConfigs = examConfigsData as Record<
          string,
          SerializedCompleteExamConfig
        >;
        examConfig = examConfigs[selectedChatModel];

        if (examConfig) {
          console.log(
            '✅ [PROMPT SYSTEM] Exam config loaded for:',
            examConfig.name,
          );
        } else {
          console.warn(
            '⚠️ [PROMPT SYSTEM] No exam config found for model:',
            selectedChatModel,
          );
        }

        // Use current section from request body if provided
        currentSection = requestCurrentSection ?? undefined;
        if (currentSection) {
          console.log(
            '🎯 [PROMPT SYSTEM] Using current section from request:',
            currentSection,
          );
          if (requestCurrentSubsection) {
            console.log(
              '🎯 [PROMPT SYSTEM] Current subsection:',
              requestCurrentSubsection,
            );
          }
        }
      } catch (error) {
        console.error(
          '❌ [PROMPT SYSTEM] Failed to load exam configuration:',
          error,
        );
        // Continue without exam config - will use fallback prompt
      }
    }

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createDataStream({
      execute: (dataStream) => {
        const systemPromptContent = systemPrompt({
          selectedChatModel,
          requestHints,
          examConfig,
          currentSection,
        });

        // Per-request guard to prevent multiple playAudio tool executions in one assistant turn.
        const requestState = { playAudioCalledThisRequest: false };

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPromptContent,
          messages,
          // Exam evaluators: 2 steps allows text + tool call + follow-up text.
          // (1 step caused tool-only responses with no spoken text.)
          maxSteps: isExamEvaluator(selectedChatModel) ? 2 : 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : isExamEvaluator(selectedChatModel)
                ? [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                    'examSectionControl',
                    'playAudio',
                    'getAudioTranscript',
                    'displayImage',
                  ]
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                  ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            examSectionControl: examSectionControl({ dataStream }),
            playAudio: playAudioTool({
              session,
              dataStream,
              examConfig,
              requestState,
            }),
            getAudioTranscript: getAudioTranscript({ examConfig }),
            displayImage: displayImageTool({ session, dataStream }),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [message],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
      );
    } else {
      return new Response(stream);
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Return a generic error response for unexpected errors
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
