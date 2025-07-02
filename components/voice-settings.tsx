'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { MicrophoneIcon, VolumeIcon, VolumeOffIcon } from './icons';
import { VOICE_LANGUAGES, type VoiceLanguage } from '@/hooks/use-voice';
import { useLocalStorage } from 'usehooks-ts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface VoiceSettingsProps {
  className?: string;
}

export function VoiceSettings({ className }: VoiceSettingsProps) {
  const [voiceLanguage, setVoiceLanguage] = useLocalStorage<VoiceLanguage>(
    'voice-language',
    'es-ES',
  );
  const [autoRead, setAutoRead] = useLocalStorage('auto-read-messages', false);
  const [examMode, setExamMode] = useLocalStorage('icao-exam-mode', false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', className)}
          title="Voice Settings"
        >
          {autoRead ? (
            <div className="text-blue-600 dark:text-blue-400">
              <VolumeIcon size={16} />
            </div>
          ) : (
            <VolumeOffIcon size={16} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-semibold">
          🎤 Voice Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => setAutoRead(!autoRead)}>
          <div className="flex items-center justify-between w-full">
            <span>Auto-read responses</span>
            <div
              className={cn(
                'w-4 h-4 rounded-sm border border-gray-300',
                autoRead && 'bg-blue-600 border-blue-600',
              )}
            >
              {autoRead && (
                <div className="size-full flex items-center justify-center">
                  <div className="size-2 bg-white rounded-sm" />
                </div>
              )}
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setExamMode(!examMode)}>
          <div className="flex items-center justify-between w-full">
            <span>ICAO Exam Mode</span>
            <div
              className={cn(
                'w-4 h-4 rounded-sm border border-gray-300',
                examMode && 'bg-orange-600 border-orange-600',
              )}
            >
              {examMode && (
                <div className="size-full flex items-center justify-center">
                  <div className="size-2 bg-white rounded-sm" />
                </div>
              )}
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-gray-500">
          Voice Language
        </DropdownMenuLabel>

        {Object.entries(VOICE_LANGUAGES).map(([code, config]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setVoiceLanguage(code as VoiceLanguage)}
          >
            <div className="flex items-center justify-between w-full">
              <span>{config.name}</span>
              {voiceLanguage === code && (
                <div className="size-2 bg-blue-600 rounded-full" />
              )}
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-gray-500">
          {examMode
            ? '🎯 Exam mode: Slower speech for clarity'
            : '💬 Normal conversation mode'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Hook to access voice settings
export function useVoiceSettings() {
  const [voiceLanguage] = useLocalStorage<VoiceLanguage>(
    'voice-language',
    'es-ES',
  );
  const [autoRead] = useLocalStorage('auto-read-messages', false);
  const [examMode] = useLocalStorage('icao-exam-mode', false);

  return {
    voiceLanguage,
    autoRead,
    examMode,
  };
}
