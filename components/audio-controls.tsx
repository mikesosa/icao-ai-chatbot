'use client';
import { Button } from './ui/button';
import { Mic, MicOff, Phone } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toggle } from '@/components/ui/toggle';
import MicFFT from '@/components/mic-fft';
import { cn } from '@/lib/utils';

export default function AudioControls({
  isRecording,
}: {
  isRecording: boolean;
}) {
  // TODO: Implement audio controls
  const { disconnect, status, isMuted, unmute, mute, micFft } = {
    disconnect: () => {},
    status: { value: 'connected' },
    isMuted: false,
    unmute: () => {},
    mute: () => {},
    micFft: [12],
  };

  if (!isRecording) {
    return null;
  }

  return (
    <div
      className={cn(
        'bottom-0 left-0 p-4 pb-6 flex items-center justify-center w-full',
        'bg-gradient-to-t from-card via-card/90 to-card/0',
      )}
    >
      <AnimatePresence>
        {status.value === 'connected' ? (
          <motion.div
            initial={{
              y: '100%',
              opacity: 0,
            }}
            animate={{
              y: 0,
              opacity: 1,
            }}
            exit={{
              y: '100%',
              opacity: 0,
            }}
            className={
              'p-4 bg-card border border-border/50 rounded-full flex items-center gap-4'
            }
          >
            <Toggle
              className={'rounded-full'}
              pressed={!isMuted}
              onPressedChange={() => {
                if (isMuted) {
                  unmute();
                } else {
                  mute();
                }
              }}
            >
              {isMuted ? (
                <MicOff className={'size-4'} />
              ) : (
                <Mic className={'size-4'} />
              )}
            </Toggle>

            <div className={'relative grid h-8 w-48 shrink grow-0'}>
              <MicFFT fft={micFft} className={'fill-current'} />
            </div>

            <Button
              className={'flex items-center gap-1 rounded-full'}
              onClick={() => {
                disconnect();
              }}
              variant={'destructive'}
            >
              <span>
                <Phone
                  className={'size-4 opacity-50 fill-current'}
                  strokeWidth={0}
                />
              </span>
              <span>End Call</span>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
