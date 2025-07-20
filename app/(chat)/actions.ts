'use server';

import { cookies } from 'next/headers';

import { type UIMessage, generateText } from 'ai';

import { auth } from '@/app/(auth)/auth';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import {
  deleteAllChatsByUserId,
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import { MODEL_IDS } from '@/lib/types';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: aiTitle } = await generateText({
    model: myProvider.languageModel(MODEL_IDS.TITLE_MODEL),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 50 characters long
    - the title should be a concise summary of the user's message
    - do not use quotes or colons
    - focus on the main topic or question being asked
    - use simple, clear language`,
    prompt: JSON.stringify(message),
  });

  // Get current date and time
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Create a title with date and AI-generated description
  const title = `${dateStr} ${timeStr} - ${aiTitle}`;

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function clearAllChats() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return await deleteAllChatsByUserId({ userId: session.user.id });
}
