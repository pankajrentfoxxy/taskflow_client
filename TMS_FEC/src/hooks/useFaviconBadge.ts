'use client';

import { useEffect } from 'react';

const BASE_TITLE = 'TaskFlow';
const ICON_PATH = '/icon.svg';

let baseIconPromise: Promise<HTMLImageElement> | null = null;

function loadBaseIcon(): Promise<HTMLImageElement> {
  if (!baseIconPromise) {
    baseIconPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load favicon'));
      img.src = ICON_PATH;
    });
  }
  return baseIconPromise;
}

function drawBadgedIcon(base: HTMLImageElement, count: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return ICON_PATH;

  ctx.drawImage(base, 0, 0, 64, 64);

  const label = count > 9 ? '9+' : String(count);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(48, 16, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 48, 17);

  return canvas.toDataURL('image/png');
}

function setAllFavicons(href: string, type?: string) {
  const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  if (links.length === 0) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    if (type) link.type = type;
    document.head.appendChild(link);
    return;
  }

  links.forEach((link) => {
    link.href = href;
    if (type) link.type = type;
    else link.removeAttribute('type');
  });
}

function setDocumentTitle(unread: number) {
  document.title = unread > 0
    ? `(${unread > 9 ? '9+' : unread}) ${BASE_TITLE}`
    : BASE_TITLE;
}

export function useFaviconBadge(unread: number): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let cancelled = false;
    let applying = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const apply = async () => {
      if (applying || cancelled) return;
      applying = true;
      try {
        setDocumentTitle(unread);

        if (unread <= 0) {
          setAllFavicons(ICON_PATH, 'image/svg+xml');
          return;
        }

        const base = await loadBaseIcon();
        if (cancelled) return;
        setAllFavicons(drawBadgedIcon(base, unread), 'image/png');
      } catch {
        if (!cancelled) setAllFavicons(ICON_PATH, 'image/svg+xml');
      } finally {
        applying = false;
      }
    };

    void apply();

    const observer = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void apply(), 80);
    });

    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'rel'] });

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      observer.disconnect();
      setDocumentTitle(0);
      setAllFavicons(ICON_PATH, 'image/svg+xml');
    };
  }, [unread]);
}
