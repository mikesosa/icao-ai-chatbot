'use client';

import { useState } from 'react';
import { useHumeTTS } from '@/hooks/use-hume-tts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Volume2, Square, Loader2 } from 'lucide-react';

export function TTSExample() {
  const [text, setText] = useState(
    'Hello! This is a test of Hume AI&apos;s text-to-speech capabilities.',
  );
  const [apiKey, setApiKey] = useState('');
  const [voiceDescription, setVoiceDescription] = useState(
    'A friendly, warm voice with clear pronunciation',
  );

  const { playText, stopAudio, isPlaying, isLoading, error } = useHumeTTS({
    apiKey,
    voice: voiceDescription,
  });

  const handlePlay = () => {
    if (!apiKey.trim()) {
      alert('Please enter your Hume API key');
      return;
    }
    playText(text);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Hume AI Text-to-Speech Demo
        </CardTitle>
        <CardDescription>
          Convert text to natural-sounding speech using Hume&apos;s Octave TTS
          model
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">Hume API Key</Label>
          <Input
            id="api-key"
            type="password"
            placeholder="Enter your Hume API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Get your API key from{' '}
            <a
              href="https://platform.hume.ai/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              platform.hume.ai
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice-description">
            Voice Description (Optional)
          </Label>
          <Input
            id="voice-description"
            placeholder="Describe the voice characteristics"
            value={voiceDescription}
            onChange={(e) => setVoiceDescription(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Describe how the voice should sound (e.g., &quot;A young, energetic
            voice with a British accent&quot;)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="text-input">Text to Speak</Label>
          <Textarea
            id="text-input"
            placeholder="Enter the text you want to convert to speech"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handlePlay}
            disabled={isLoading || isPlaying || !text.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {isLoading ? 'Generating...' : 'Play'}
          </Button>

          <Button
            onClick={stopAudio}
            disabled={!isPlaying}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isPlaying && (
          <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
            Playing audio...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
