'use client';

import { ChatPageLayout } from '@/components/chat-page-layout';
import { Session } from 'next-auth';
import type { UIMessage } from 'ai';

interface ChatPageContentProps {
  session: Session;
  id: string;
  modelId: string;
  initialMessages: UIMessage[];
  modelType?: string;
  initialVisibilityType: 'private' | 'public';
  isReadonly: boolean;
}

export function ChatPageContent({
  session,
  id,
  modelId,
  initialMessages,
  modelType,
  initialVisibilityType,
  isReadonly,
}: ChatPageContentProps) {
  return (
    <ChatPageLayout
      session={session}
      id={id}
      modelId={modelId}
      initialMessages={initialMessages}
      modelType={modelType}
      initialVisibilityType={initialVisibilityType}
      isReadonly={isReadonly}
      autoResume={true}
    />
  );
}
