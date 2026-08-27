'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Mic } from 'lucide-react';
import AuthImage from '@/components/AuthImage';
import VoiceNotePlayer from '@/components/VoiceNotePlayer';
import { uploadUrl } from '@/lib/util';
import { cn } from '@/lib/utils';

export type AttachmentLike = {
  id: number;
  file_name: string;
  mime_type: string;
  size?: number;
  context?: string;
};

function AuthVoiceNote({
  id,
  variant = 'default',
  className,
}: {
  id: number;
  variant?: 'default' | 'inverted';
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(uploadUrl(id), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load audio');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!src) {
    return (
      <div className={cn('flex h-10 items-center gap-2 rounded-lg px-2', variant === 'inverted' ? 'bg-white/10' : 'bg-muted', className)}>
        <Mic className={cn('size-4', variant === 'inverted' ? 'text-white/60' : 'text-muted-foreground')} />
        <span className={cn('text-xs', variant === 'inverted' ? 'text-white/60' : 'text-muted-foreground')}>Loading voice…</span>
      </div>
    );
  }

  return <VoiceNotePlayer src={src} variant={variant} className={className} />;
}

export default function AttachmentMedia({
  attachment,
  compact = false,
  variant = 'default',
  className,
}: {
  attachment: AttachmentLike;
  compact?: boolean;
  variant?: 'default' | 'inverted';
  className?: string;
}) {
  const mime = attachment.mime_type || '';
  const isImage = mime.startsWith('image/');
  const isAudio = mime.startsWith('audio/');

  if (isImage) {
    return (
      <a
        href={uploadUrl(attachment.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('block overflow-hidden rounded-lg border', className)}
      >
        <AuthImage
          id={attachment.id}
          alt={attachment.file_name}
          className={compact ? 'max-h-40 w-full object-cover' : 'max-h-56 w-full object-cover'}
        />
        {!compact && (
          <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">{attachment.file_name}</div>
        )}
      </a>
    );
  }

  if (isAudio) {
    return (
      <div className={cn('space-y-1', className)}>
        <AuthVoiceNote id={attachment.id} variant={variant} />
        {!compact && variant !== 'inverted' && (
          <div className="truncate text-[11px] text-muted-foreground">{attachment.file_name}</div>
        )}
      </div>
    );
  }

  return (
    <a
      href={uploadUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40',
        className
      )}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
      <Download className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}
