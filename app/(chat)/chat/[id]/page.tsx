import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import type { Attachment, UIMessage } from 'ai';

import { auth } from '@/app/(auth)/auth';
import { ChatPageContent } from '@/components/chat-page-content';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import type { DBMessage } from '@/lib/db/schema';
import { isValidExamModel } from '@/lib/types';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    notFound();
  }

  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/chat/${id}`)}`);
  }

  if (chat.visibility === 'private') {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  function convertToUIMessages(messages: Array<DBMessage>): Array<UIMessage> {
    return messages.map((message) => ({
      id: message.id,
      parts: message.parts as UIMessage['parts'],
      role: message.role as UIMessage['role'],
      // Note: content will soon be deprecated in @ai-sdk/react
      content: '',
      createdAt: message.createdAt,
      experimental_attachments:
        (message.attachments as Array<Attachment>) ?? [],
    }));
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get('chat-model');
  const modelId = chatModelFromCookie?.value;
  const resolvedModelId =
    modelId && isValidExamModel(modelId) ? modelId : DEFAULT_CHAT_MODEL;

  return (
    <ChatPageContent
      session={session}
      id={id}
      modelId={resolvedModelId}
      initialMessages={convertToUIMessages(messagesFromDb)}
      initialVisibilityType={chat.visibility}
      isReadonly={session?.user?.id !== chat.userId}
    />
  );
}
