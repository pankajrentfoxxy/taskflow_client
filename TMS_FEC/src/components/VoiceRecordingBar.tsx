'use client';

import { Square } from 'lucide-react';
import { formatDuration } from '@/lib/formatDuration';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function VoiceRecordingBar({
  durationSec,
  onStop,
  className,
}: {
  durationSec: number;
  onStop: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-70" />
          <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
        </span>
        <span className="font-medium">Recording</span>
        <span className="tabular-nums text-red-600">{formatDuration(durationSec)}</span>
      </div>
      <Button type="button" size="xs" variant="outline" className="border-red-200 bg-white hover:bg-red-50" onClick={onStop}>
        <Square className="mr-1 size-3 fill-current" />
        Stop
      </Button>
    </div>
  );
}
