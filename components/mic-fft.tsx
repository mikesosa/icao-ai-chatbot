'use client';

import { motion } from 'framer-motion';
import { AutoSizer } from 'react-virtualized';

import { cn } from '@/lib/utils';

export default function MicFFT({
  fft,
  className,
}: {
  fft: number[];
  className?: string;
}) {
  return (
    <div className={'relative size-full'}>
      <AutoSizer>
        {({ width, height }) => (
          <motion.svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className={cn('absolute !inset-0 !size-full', className)}
          >
            {Array.from({ length: 24 }, (_, index) => {
              const value = (fft[index] ?? 0) / 4;
              const h = Math.min(Math.max(height * value, 2), height);
              const yOffset = height * 0.5 - h * 0.5;
              const barId = `bar-${index}`;

              return (
                <motion.rect
                  key={barId}
                  height={h}
                  width={2}
                  x={2 + (index * width - 4) / 24}
                  y={yOffset}
                  rx={4}
                />
              );
            })}
          </motion.svg>
        )}
      </AutoSizer>
    </div>
  );
}
