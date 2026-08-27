'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Plus, SmilePlus } from 'lucide-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export const QUICK_MESSAGE_REACTIONS = ['👍', '❤️', '😀', '😢', '🙏', '👎', '😡'];

type ChatMessageReactionPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  placement?: 'top' | 'bottom';
};

export default function ChatMessageReactionPicker({
  open,
  onOpenChange,
  onSelect,
  placement = 'top',
}: ChatMessageReactionPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullPickerOpen, setFullPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) setFullPickerOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, onOpenChange]);

  const pickEmoji = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  const handleFullPickerClick = (data: EmojiClickData) => {
    pickEmoji(data.emoji);
    setFullPickerOpen(false);
  };

  const panelPosition =
    placement === 'top' ? 'bottom-full left-0 mb-2' : 'top-full left-0 mt-2';

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        title="Add reaction"
        onClick={() => onOpenChange(!open)}
      >
        <SmilePlus className="size-3.5" />
      </Button>

      {open && !fullPickerOpen && (
        <div
          className={cn(
            'absolute z-50 flex items-center gap-0.5 rounded-full border border-border/60 bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm',
            panelPosition
          )}
        >
          {QUICK_MESSAGE_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-full px-1.5 py-0.5 text-xl leading-none transition hover:scale-110 hover:bg-muted/80"
              onClick={() => pickEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="ml-0.5 flex size-7 items-center justify-center rounded-full text-primary transition hover:bg-muted/80"
            title="More reactions"
            onClick={() => setFullPickerOpen(true)}
          >
            <Plus className="size-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {open && fullPickerOpen && (
        <div
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl border bg-popover shadow-lg',
            panelPosition
          )}
        >
          <EmojiPicker
            onEmojiClick={handleFullPickerClick}
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
            width={320}
            height={380}
            theme={Theme.LIGHT}
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  );
}
