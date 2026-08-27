'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SmilePlus } from 'lucide-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

type ChatEmojiPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  size?: 'sm' | 'md';
  title?: string;
};

export default function ChatEmojiPicker({
  open,
  onOpenChange,
  onSelect,
  disabled = false,
  placement = 'top',
  size = 'md',
  title = 'Pick emoji',
}: ChatEmojiPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

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

  const handleEmojiClick = (data: EmojiClickData) => {
    onSelect(data.emoji);
    onOpenChange(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'icon-xs' : 'icon-sm'}
        className={cn(size === 'sm' && 'text-muted-foreground')}
        disabled={disabled}
        title={title}
        onClick={() => onOpenChange(!open)}
      >
        <SmilePlus className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      </Button>
      {open && (
        <div
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl border bg-popover shadow-lg',
            placement === 'top' ? 'bottom-full left-0 mb-2' : 'top-full left-0 mt-2'
          )}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
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
