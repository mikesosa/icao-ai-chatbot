import { cookies } from 'next/headers';

import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';
import { ChatPageContent } from '@/components/chat-page-content';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  return (
    <ChatPageContent
      session={session}
      id={id}
      modelId={
        !modelIdFromCookie ? DEFAULT_CHAT_MODEL : modelIdFromCookie.value
      }
      initialMessages={[]}
      initialVisibilityType="private"
      isReadonly={false}
    />
  );
}
