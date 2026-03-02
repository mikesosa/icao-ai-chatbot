import { headers , cookies } from 'next/headers';

import { ChatPageContent } from '@/components/chat-page-content';
import { LandingPage } from '@/components/landing-page';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import type { Locale } from '@/lib/i18n/landing';
import { isValidExamModel } from '@/lib/types';
import { generateUUID } from '@/lib/utils';

import { auth } from '../(auth)/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get('locale')?.value;

    let locale: Locale = 'en';
    if (localeCookie === 'en' || localeCookie === 'es') {
      locale = localeCookie;
    } else {
      const headersList = await headers();
      const acceptLanguage = headersList.get('accept-language') ?? '';
      if (/\bes\b/i.test(acceptLanguage)) locale = 'es';
    }

    return <LandingPage locale={locale} />;
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
