'use client';

import { useEffect, useState } from 'react';
import { uploadUrl } from '@/lib/util';

export default function AuthImage({
  id,
  alt = '',
  className,
}: {
  id: number | string;
  alt?: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(uploadUrl(id), { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load image');
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
    return <div className={`bg-muted ${className || ''}`} aria-hidden />;
  }

  return <img src={src} alt={alt} className={className} />;
}
