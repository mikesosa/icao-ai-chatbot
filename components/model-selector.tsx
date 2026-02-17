'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import type { Session } from 'next-auth';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExamConfigs } from '@/hooks/use-exam-configs';
import { useExamContext } from '@/hooks/use-exam-context';
import {
  entitlementsByUserType,
  getUpdatedEntitlements,
} from '@/lib/ai/entitlements';
import { chatModels, generateChatModelsFromConfigs } from '@/lib/ai/models';
import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';

export function ModelSelector({
  session,
  selectedModelId,
  className,
}: {
  session: Session;
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const { examType } = useExamContext();
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const userType = session.user.type;

  // Use SWR to get latest exam configurations
  const { configs, isLoading } = useExamConfigs();

  // Generate models and entitlements based on available data
  const { availableModels, availableChatModelIds } = useMemo(() => {
    if (Object.keys(configs).length > 0) {
      // Use latest data from SWR
      const models = generateChatModelsFromConfigs(configs);
      const entitlements = getUpdatedEntitlements(configs);
      return {
        availableModels: models,
        availableChatModelIds: entitlements[userType].availableChatModelIds,
      };
    } else {
      // Use fallback data for SSR/loading states
      return {
        availableModels: chatModels,
        availableChatModelIds:
          entitlementsByUserType[userType].availableChatModelIds,
      };
    }
  }, [configs, userType]);

  const availableChatModels = useMemo(() => {
    const models = availableModels.filter((chatModel) =>
      availableChatModelIds.includes(chatModel.id),
    );

    // If examType is provided and is a valid model, only show that model
    if (examType) {
      const modelTypeModel = models.find((model) => model.id === examType);
      if (modelTypeModel) {
        return [modelTypeModel];
      }
    }

    return models;
  }, [availableChatModelIds, examType, availableModels]);

  const selectedChatModel = useMemo(() => {
    // If examType is provided and valid, use it as the selected model
    if (examType) {
      const modelTypeModel = availableChatModels.find(
        (chatModel) => chatModel.id === examType,
      );
      if (modelTypeModel) {
        return modelTypeModel;
      }
    }

    // Otherwise, use the optimistic model ID
    return availableChatModels.find(
      (chatModel) => chatModel.id === optimisticModelId,
    );
  }, [optimisticModelId, availableChatModels, examType]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        disabled={availableChatModels.length <= 1 || !!examType || isLoading}
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          id="model-selector-trigger"
          data-testid="model-selector"
          variant="outline"
          className="md:px-2 md:h-[34px]"
        >
          {isLoading ? 'Loading...' : selectedChatModel?.name}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {availableChatModels.map((chatModel) => {
          const { id } = chatModel;

          return (
            <DropdownMenuItem
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              data-active={id === optimisticModelId}
              asChild
            >
              <button
                type="button"
                className="gap-4 group/item flex flex-row justify-between items-center w-full"
              >
                <div className="flex flex-col gap-1 items-start">
                  <div>{chatModel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {chatModel.description}
                  </div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
