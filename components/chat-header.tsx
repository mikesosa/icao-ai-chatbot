'use client';

import { memo } from 'react';

import { useRouter } from 'next/navigation';

import { Volume2 } from 'lucide-react';
import type { Session } from 'next-auth';
import { useWindowSize } from 'usehooks-ts';

import { ModelSelector } from '@/components/model-selector';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { useTts } from '@/hooks/use-tts';

import { useSidebar } from './ui/sidebar';
import { Toggle } from './ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import type { VisibilityType } from './visibility-selector';

function PureChatHeader({
  chatId: _chatId,
  selectedModelId,
  selectedVisibilityType: _selectedVisibilityType,
  isReadonly,
  session,
  hideControls: _hideControls,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  hideControls?: boolean;
}) {
  const _router = useRouter();
  const { open: _open } = useSidebar();

  const { width: _windowWidth } = useWindowSize();
  const { enabled, setEnabled } = useTts();

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />

      {/* {(!open || windowWidth < 768) && !hideControls && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )} */}

      {!isReadonly && (
        <ModelSelector
          session={session}
          selectedModelId={selectedModelId}
          className="order-1 md:order-2"
        />
      )}

      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              variant="outline"
              size="sm"
              className="ml-auto"
              pressed={enabled}
              onPressedChange={(v) => setEnabled(Boolean(v))}
              aria-label="Read assistant replies aloud"
            >
              <Volume2 className="size-4" />
              <span className="sr-only">Read aloud</span>
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Read aloud</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* {!isReadonly && !hideControls && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-3"
        />
      )} */}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});
