'use client';

import { useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { motion } from 'framer-motion';
import type { User } from 'next-auth';
import { toast } from 'sonner';
import useSWRInfinite from 'swr/infinite';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { chatModels } from '@/lib/ai/models';
import type { Chat } from '@/lib/db/schema';
import { MODEL_ID_TO_TYPE_MAP, MODEL_TYPES } from '@/lib/types';
import { fetcher } from '@/lib/utils';

import { LoaderIcon } from './icons';
import { ChatItem } from './sidebar-history-item';

type DateGroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

type ModelGroupedChats = Record<string, DateGroupedChats>;

export interface ChatHistory {
  chats: Array<Chat>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): DateGroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as DateGroupedChats,
  );
};

const groupChatsByModelAndDate = (chats: Chat[]): ModelGroupedChats => {
  // Get all available model types from the chatModels array
  const availableModelTypes = new Set([
    MODEL_TYPES.GENERAL, // Always include general
    ...chatModels.map(
      (model) =>
        MODEL_ID_TO_TYPE_MAP[model.id as keyof typeof MODEL_ID_TO_TYPE_MAP],
    ),
  ]);

  // Initialize groups for all available model types
  const initialGroups: Record<string, Chat[]> = {};
  availableModelTypes.forEach((modelType) => {
    if (modelType) {
      initialGroups[modelType] = [];
    }
  });

  // Group chats by model type
  const modelGroups = chats.reduce((groups, chat) => {
    const modelType = chat.modelType || MODEL_TYPES.GENERAL;

    if (groups[modelType]) {
      groups[modelType].push(chat);
    }

    return groups;
  }, initialGroups);

  // Then, group each model type's chats by date
  const result: ModelGroupedChats = {};
  Object.keys(modelGroups).forEach((modelType) => {
    result[modelType] = groupChatsByDate(modelGroups[modelType]);
  });

  return result;
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory,
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) return `/api/history?limit=${PAGE_SIZE}`;

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) return null;

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(getChatHistoryPaginationKey, fetcher, {
    fallbackData: [],
  });

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = async () => {
    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: 'DELETE',
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate((chatHistories) => {
          if (chatHistories) {
            return chatHistories.map((chatHistory) => ({
              ...chatHistory,
              chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
            }));
          }
        });

        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push('/');
    }
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Chat History
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="rounded-md h-8 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Your conversations will appear here once you start chatting!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {paginatedChatHistories &&
              (() => {
                const chatsFromHistory = paginatedChatHistories.flatMap(
                  (paginatedChatHistory) => paginatedChatHistory.chats,
                );

                const groupedChats = groupChatsByModelAndDate(chatsFromHistory);

                const renderDateGroups = (dateGroups: DateGroupedChats) => (
                  <div className="flex flex-col gap-4">
                    {dateGroups.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Today
                        </div>
                        {dateGroups.today.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {dateGroups.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Yesterday
                        </div>
                        {dateGroups.yesterday.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {dateGroups.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Last 7 days
                        </div>
                        {dateGroups.lastWeek.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {dateGroups.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Last 30 days
                        </div>
                        {dateGroups.lastMonth.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {dateGroups.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Older than last month
                        </div>
                        {dateGroups.older.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );

                const hasChatsInGroup = (dateGroups: DateGroupedChats) => {
                  return (
                    dateGroups.today.length > 0 ||
                    dateGroups.yesterday.length > 0 ||
                    dateGroups.lastWeek.length > 0 ||
                    dateGroups.lastMonth.length > 0 ||
                    dateGroups.older.length > 0
                  );
                };

                // Get display name for model type
                const getModelDisplayName = (modelType: string) => {
                  if (modelType === MODEL_TYPES.GENERAL) {
                    return 'General Chat';
                  }

                  // Find the model in chatModels array
                  const model = chatModels.find(
                    (m) =>
                      MODEL_ID_TO_TYPE_MAP[
                        m.id as keyof typeof MODEL_ID_TO_TYPE_MAP
                      ] === modelType,
                  );
                  return model ? model.name : modelType;
                };

                // Get available model types that have chats
                const availableModelTypes = Object.keys(groupedChats).filter(
                  (modelType) => hasChatsInGroup(groupedChats[modelType]),
                );

                // Sort model types to put general chat at the end
                const sortedModelTypes = availableModelTypes.sort((a, b) => {
                  if (a === MODEL_TYPES.GENERAL && b !== MODEL_TYPES.GENERAL) {
                    return 1;
                  }
                  if (b === MODEL_TYPES.GENERAL && a !== MODEL_TYPES.GENERAL) {
                    return -1;
                  }
                  return 0;
                });

                return (
                  <div className="flex flex-col gap-4">
                    {sortedModelTypes.map((modelType) => (
                      <details
                        key={modelType}
                        className="group"
                        open={modelType !== MODEL_TYPES.GENERAL}
                      >
                        <summary className="px-2 py-1 text-xs text-sidebar-foreground/50 cursor-pointer hover:text-sidebar-foreground/70 list-none">
                          <span className="inline-flex items-center gap-2">
                            <svg
                              className="size-3 transition-transform group-open:rotate-90"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            {getModelDisplayName(modelType)}
                          </span>
                        </summary>
                        <div className="ml-4 mt-2">
                          {renderDateGroups(groupedChats[modelType])}
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
          </SidebarMenu>

          <motion.div
            onViewportEnter={() => {
              if (!isValidating && !hasReachedEnd) {
                setSize((size) => size + 1);
              }
            }}
          />

          {hasReachedEnd ? (
            <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2 mt-8">
              You have reached the end of your chat history.
            </div>
          ) : (
            <div className="p-2 text-zinc-500 dark:text-zinc-400 flex flex-row gap-2 items-center mt-8">
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <div>Loading Chats...</div>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
