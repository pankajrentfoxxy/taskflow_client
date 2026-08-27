export type ChatMentionMember = { id: number; name: string };

export type MentionQuery = {
  query: string;
  start: number;
  end: number;
};

/** Active `@filter` token immediately before the cursor (if any). */
export function detectMentionQuery(text: string, cursor: number): MentionQuery | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|[\s(])@([^\s@[\]()]*?)$/);
  if (!match) return null;
  const query = match[1];
  const atIndex = before.lastIndexOf(`@${query}`);
  if (atIndex < 0) return null;
  return { query, start: atIndex, end: cursor };
}

export function mentionDisplayName(member: ChatMentionMember): string {
  return member.name.split(' (')[0] || member.name;
}

export function formatMentionToken(member: ChatMentionMember): string {
  return `@[${mentionDisplayName(member)}](user:${member.id})`;
}

export function insertMention(
  text: string,
  mention: MentionQuery,
  member: ChatMentionMember,
): { text: string; cursor: number } {
  const snippet = `@${mentionDisplayName(member)}`;
  const next = `${text.slice(0, mention.start)}${snippet} ${text.slice(mention.end)}`;
  return { text: next, cursor: mention.start + snippet.length + 1 };
}

/** Show stored mention tokens as plain @Name in the composer. */
export function decodeMentionsForDisplay(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(user:\d+\)/g, '@$1');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convert visible @Name snippets to stored mention tokens before send. */
export function encodeMentionsForSend(text: string, members: ChatMentionMember[]): string {
  if (!members.length) return text;
  let result = decodeMentionsForDisplay(text);
  const sorted = [...members].sort(
    (a, b) => mentionDisplayName(b).length - mentionDisplayName(a).length,
  );
  for (const member of sorted) {
    const display = mentionDisplayName(member);
    const pattern = new RegExp(`@${escapeRegExp(display)}(?=$|[\\s.,!?;:])`, 'g');
    result = result.replace(pattern, formatMentionToken(member));
  }
  return result;
}

export function filterMentionMembers(
  members: ChatMentionMember[],
  query: string,
  excludeUserId?: number,
): ChatMentionMember[] {
  const q = query.trim().toLowerCase();
  return members
    .filter((m) => m.id !== excludeUserId)
    .filter((m) => {
      const name = (m.name.split(' (')[0] || m.name).toLowerCase();
      return !q || name.includes(q);
    })
    .slice(0, 8);
}

/** Split a line into plain text, markdown links, and @-mention tokens. */
export const CHAT_INLINE_TOKEN =
  /(@\[[^\]]+\]\(user:\d+\)|\[[^\]]+\]\([^)]+\))/g;

export function parseMentionDisplay(token: string): string | null {
  const match = token.match(/^@\[([^\]]+)\]\(user:\d+\)$/);
  return match ? match[1] : null;
}
