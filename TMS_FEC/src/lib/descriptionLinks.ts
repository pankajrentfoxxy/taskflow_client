export type DescriptionPart =
  | { type: 'text'; value: string }
  | { type: 'link'; label: string; href: string };

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function normalizeDescriptionUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function formatDescriptionLink(name: string, url: string): string {
  const label = name.trim();
  const href = normalizeDescriptionUrl(url);
  if (!label || !href) return '';
  return `[${label}](${href})`;
}

export function parseDescription(text: string): DescriptionPart[] {
  if (!text) return [];

  const parts: DescriptionPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }
    const label = match[1]?.trim() || '';
    const href = normalizeDescriptionUrl(match[2] || '');
    if (label && href) {
      parts.push({ type: 'link', label, href });
    } else if (match[0]) {
      parts.push({ type: 'text', value: match[0] });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: 'text', value: text }];
}

export function insertDescriptionLink(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  name: string,
  url: string,
): { value: string; cursor: number } | null {
  const snippet = formatDescriptionLink(name, url);
  if (!snippet) return null;

  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const before = text.slice(0, start);
  const after = text.slice(end);
  const value = `${before}${snippet}${after}`;
  return { value, cursor: before.length + snippet.length };
}
