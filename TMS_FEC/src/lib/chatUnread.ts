import type { ChatUpdatePayload } from '@/lib/socket';

const STORAGE_KEY = 'tf_chat_unread_v1';
export const CHAT_UNREAD_EVENT = 'tf:chat-unread-changed';

export type ChatUnreadEntry = {
  conversationId: number;
  name: string;
  preview: string;
  count: number;
  updatedAt: number;
  kind?: string;
};

type StoredState = {
  counts: Record<string, number>;
  entries: Record<string, Omit<ChatUnreadEntry, 'count' | 'conversationId'>>;
};

let activeConversationId: number | null = null;
let onChatPage = false;

function loadState(): StoredState {
  if (typeof window === 'undefined') return { counts: {}, entries: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { counts: {}, entries: {} };
    const parsed = JSON.parse(raw) as StoredState;
    return {
      counts: parsed.counts || {},
      entries: parsed.entries || {},
    };
  } catch {
    return { counts: {}, entries: {} };
  }
}

function saveState(state: StoredState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notifyChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHAT_UNREAD_EVENT));
}

export function subscribeChatUnread(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHAT_UNREAD_EVENT, handler);
  return () => window.removeEventListener(CHAT_UNREAD_EVENT, handler);
}

export function setChatPageActive(active: boolean) {
  onChatPage = active;
}

export function setActiveChatConversationId(id: number | null) {
  activeConversationId = id;
  if (id != null && onChatPage) {
    markChatConversationRead(id);
  }
}

export function getChatUnreadTotal(): number {
  const { counts } = loadState();
  return Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function getChatUnreadEntries(): ChatUnreadEntry[] {
  const { counts, entries } = loadState();
  return Object.entries(counts)
    .map(([id, count]) => {
      const conversationId = Number(id);
      const meta = entries[id];
      return {
        conversationId,
        count: Number(count) || 0,
        name: meta?.name || 'Chat',
        preview: meta?.preview || 'New message',
        updatedAt: meta?.updatedAt || 0,
        kind: meta?.kind,
      };
    })
    .filter((e) => e.count > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function markChatConversationRead(conversationId: number) {
  const state = loadState();
  const key = String(conversationId);
  if (!state.counts[key]) return;
  delete state.counts[key];
  delete state.entries[key];
  saveState(state);
  notifyChanged();
}

export function handleChatUpdatePayload(payload: ChatUpdatePayload, meId: number | null) {
  if (!meId) return;
  if (payload.action !== 'message') return;

  const message = payload.message;
  const conversation = payload.conversation;
  if (!message || !conversation?.id) return;
  if (message.deleted_at) return;
  if (message.author_id === meId) return;

  const conversationId = conversation.id;
  if (onChatPage && activeConversationId === conversationId) {
    markChatConversationRead(conversationId);
    return;
  }

  const state = loadState();
  const key = String(conversationId);
  const preview =
    message.body?.trim() ||
    (message.attachments?.length ? '[Attachment]' : conversation.last_message_preview || 'New message');

  state.counts[key] = (state.counts[key] || 0) + 1;
  state.entries[key] = {
    name: conversation.member_name || conversation.name || 'Chat',
    preview: preview.slice(0, 120),
    updatedAt: message.created_at || Date.now(),
    kind: conversation.kind,
  };
  saveState(state);
  notifyChanged();
}
