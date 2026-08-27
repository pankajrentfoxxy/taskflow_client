'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatDuration } from '@/lib/formatDuration';
import { cn } from '@/lib/utils';

export default function VoiceNotePlayer({
  src,
  variant = 'default',
  className,
}: {
  src: string;
  variant?: 'default' | 'inverted';
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const inverted = variant === 'inverted';

  return (
    <div className={cn('flex min-w-[200px] max-w-[280px] items-center gap-2.5', className)}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition',
          inverted ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-primary/10 text-primary hover:bg-primary/15'
        )}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'relative h-1.5 overflow-hidden rounded-full',
            inverted ? 'bg-white/25' : 'bg-muted-foreground/20'
          )}
        >
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-[width]', inverted ? 'bg-white' : 'bg-primary')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={cn('mt-1 flex justify-between text-[10px] tabular-nums', inverted ? 'text-white/75' : 'text-muted-foreground')}>
          <span>{formatDuration(current)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}
