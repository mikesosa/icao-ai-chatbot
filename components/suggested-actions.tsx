'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers['append'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  append,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const suggestedActions: any[] = [
    // {
    //   title: 'What are the advantages of',
    //   label: 'getting certified by ICAO?',
    //   action: 'What are the advantages of getting certified by ICAO?',
    // },
    // {
    //   title: 'ICAO Exam Preparation',
    //   label: 'Help me study for ICAO English test',
    //   action:
    //     'I need help preparing for my ICAO English language proficiency test. Can you provide study materials and practice questions?',
    // },
    // {
    //   title: 'Aviation Communication',
    //   label: 'Practice radio phraseology',
    //   action:
    //     'I want to practice standard ICAO radio phraseology for air traffic control communications. Can you help me with common phrases and procedures?',
    // },
    // {
    //   title: 'Flight Planning',
    //   label: 'Weather briefing assistance',
    //   action:
    //     'I need help understanding weather reports and NOTAMs for flight planning. Can you explain the key elements I should focus on?',
    // },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              // Check if we're in TEA mode by looking at the current URL path
              const isTeaMode = window.location.pathname.includes('/tea/');
              const redirectPath = isTeaMode
                ? `/tea/${chatId}`
                : `/chat/${chatId}`;
              window.history.replaceState({}, '', redirectPath);

              append({
                role: 'user',
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;

    return true;
  },
);
