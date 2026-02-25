import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ChatPageContent } from '@/components/chat-page-content';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { isValidExamModel } from '@/lib/types';
import { generateUUID } from '@/lib/utils';

import { auth } from '../(auth)/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login?callbackUrl=%2F');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const modelId = modelIdFromCookie?.value;
  const resolvedModelId =
    modelId && isValidExamModel(modelId) ? modelId : DEFAULT_CHAT_MODEL;

  return (
    <ChatPageContent
      session={session}
      id={id}
      modelId={resolvedModelId}
      initialMessages={[]}
      initialVisibilityType="private"
      isReadonly={false}
    />
  );
}
