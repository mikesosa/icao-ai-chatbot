'use client';

import type { UIMessage } from 'ai';
import type { Session } from 'next-auth';

import { ChatPageLayout } from '@/components/chat-page-layout';

interface ChatPageContentProps {
  session: Session;
  id: string;
  modelId: string;
  initialMessages: UIMessage[];
  initialVisibilityType: 'private' | 'public';
  isReadonly: boolean;
}

export function ChatPageContent({
  session,
  id,
  modelId,
  initialMessages,
  initialVisibilityType,
  isReadonly,
}: ChatPageContentProps) {
  return (
    <ChatPageLayout
      session={session}
      id={id}
      modelId={modelId}
      initialMessages={initialMessages}
      initialVisibilityType={initialVisibilityType}
      isReadonly={isReadonly}
      autoResume={true}
    />
  );
}
