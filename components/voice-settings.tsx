'use client';

import { Volume2, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTts } from '@/hooks/use-tts';
import { OPENAI_TTS_VOICES } from '@/lib/voice/openai';

export function VoiceSettings() {
  const {
    enabled,
    selectedVoice,
    speechRate,
    setEnabled,
    setSelectedVoice,
    setSpeechRate,
  } = useTts();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id="voice-settings-trigger"
          variant="ghost"
          size="icon"
          className="rounded-full"
          title={
            enabled ? 'Voice settings (enabled)' : 'Voice settings (disabled)'
          }
        >
          {enabled ? (
            <Volume2 className="size-4" />
          ) : (
            <VolumeX className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel>Voice Settings</DropdownMenuLabel>
        <div className="px-2 py-1 text-sm text-muted-foreground">
          Configure OpenAI text-to-speech for exam responses
        </div>
        <DropdownMenuSeparator />

        <div className="space-y-3 p-2">
          {/* TTS Enable/Disable */}
          <div className="flex items-center justify-between">
            <label htmlFor="tts-enabled" className="text-sm font-medium">
              Enable TTS
            </label>
            <Button
              id="tts-enabled"
              variant={enabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEnabled(!enabled)}
            >
              {enabled ? 'On' : 'Off'}
            </Button>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label htmlFor="voice-select" className="text-sm font-medium">
              Voice
            </label>
            <select
              id="voice-select"
              value={selectedVoice || ''}
              onChange={(e) => setSelectedVoice(e.target.value || null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!enabled}
            >
              <option value="">Default (alloy)</option>
              {OPENAI_TTS_VOICES.map((voice) => (
                <option key={voice} value={voice}>
                  {voice.charAt(0).toUpperCase() + voice.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Speech Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="speech-rate" className="text-sm font-medium">
                Playback Speed
              </label>
              <span className="text-sm text-muted-foreground">
                {speechRate}x
              </span>
            </div>
            <input
              id="speech-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number.parseFloat(e.target.value))}
              className="w-full"
              disabled={!enabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
