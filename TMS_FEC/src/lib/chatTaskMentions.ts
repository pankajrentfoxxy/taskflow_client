import type { MentionQuery } from './chatMentions';

export type ChatTaskMention = {
  id: number;
  title: string;
  status?: string;
  assignee_name?: string | null;
  description?: string | null;
};

/** Active `@tfilter` token immediately before the cursor (if any). */
export function detectTaskMentionQuery(text: string, cursor: number): MentionQuery | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|[\s(])@t([^\s@[\]()]*?)$/i);
  if (!match) return null;
  const query = match[1];
  const token = `@t${query}`;
  const atIndex = before.toLowerCase().lastIndexOf(token.toLowerCase());
  if (atIndex < 0) return null;
  return { query, start: atIndex, end: cursor };
}

export function clearTaskMentionToken(
  text: string,
  mention: MentionQuery,
): { text: string; cursor: number } {
  const before = text.slice(0, mention.start);
  const after = text.slice(mention.end);
  const next = `${before}${after}`;
  return { text: next, cursor: mention.start };
}

export function filterChatTasks(tasks: ChatTaskMention[], query: string): ChatTaskMention[] {
  const q = query.trim().toLowerCase();
  return tasks
    .filter((task) => {
      if (!q) return true;
      if (String(task.id).includes(q)) return true;
      if ((task.title || '').toLowerCase().includes(q)) return true;
      if ((task.assignee_name || '').toLowerCase().includes(q)) return true;
      return false;
    })
    .slice(0, 8);
}
