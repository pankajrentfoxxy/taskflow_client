import { io, type Socket } from 'socket.io-client';

export function socketBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  return raw.replace(/\/api\/?$/, '');
}

let socket: Socket | null = null;
let subscribers = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

const DISCONNECT_DELAY_MS = 1000;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketBaseUrl(), {
      path: '/api/socket.io',
      withCredentials: true,
      autoConnect: false,
      // Polling first is more reliable behind nginx; upgrades to websocket when ready.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  subscribers += 1;
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Release a subscriber; disconnect only after delay when nothing needs the socket. */
export function releaseSocket(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) return;

  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = setTimeout(() => {
    if (subscribers === 0 && socket?.connected) socket.disconnect();
    disconnectTimer = null;
  }, DISCONNECT_DELAY_MS);
}

/** Force disconnect (logout). */
export function disconnectSocket(): void {
  subscribers = 0;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (socket) socket.disconnect();
}

export const REALTIME_TASK_EVENT = 'tf:task-changed';
export const REALTIME_PRESENCE_EVENT = 'tf:presence';
export const REALTIME_NOTIFICATION_EVENT = 'tf:notification';
export const REALTIME_ME_REFRESH_EVENT = 'tf:me-refresh';
export const REALTIME_CHAT_EVENT = 'tf:chat-update';
export const REALTIME_CHAT_TYPING_EVENT = 'tf:chat-typing';

export type ChatUpdatePayload = {
  action?: string;
  conversation?: ConversationPreview;
  message?: ChatMessagePayload;
};

export type ChatTypingPayload = {
  conversationId: number;
  userId: number;
  userName: string;
  typing: boolean;
};

export type ConversationPreview = {
  id: number;
  kind?: 'direct' | 'group' | string;
  name?: string | null;
  member_user_id?: number | null;
  member_name?: string;
  member_email?: string | null;
  member_role?: string;
  member_count?: number | null;
  member_names?: string | null;
  member_list?: { id: number; name: string }[] | null;
  last_message_at?: number | null;
  last_message_preview?: string | null;
};

export type ChatMessagePayload = {
  id: number;
  conversation_id: number;
  author_id: number;
  author_name: string;
  parent_message_id: number | null;
  body: string | null;
  edited: boolean;
  edited_at: number | null;
  deleted_at: number | null;
  created_at: number;
  reactions?: { emoji: string; count: number; mine: boolean }[];
  attachments?: {
    id: number;
    file_name: string;
    mime_type: string;
    size?: number;
    context?: string;
  }[];
};

export type PresencePayload = {
  onlineCount?: number;
  onlineUsers?: number[];
  onlineUserList?: { id: number; name: string }[];
};

let lastPresencePayload: PresencePayload | null = null;

export function dispatchTaskChanged(detail: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_TASK_EVENT, { detail }));
}

export function dispatchPresence(detail: unknown): void {
  if (typeof window === 'undefined') return;
  lastPresencePayload = detail as PresencePayload;
  window.dispatchEvent(new CustomEvent(REALTIME_PRESENCE_EVENT, { detail }));
}

export function dispatchNotification(detail: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_NOTIFICATION_EVENT, { detail }));
}

export function dispatchMeRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REALTIME_ME_REFRESH_EVENT));
}

export function dispatchChatUpdate(detail: ChatUpdatePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_CHAT_EVENT, { detail }));
}

export function dispatchChatTyping(detail: ChatTypingPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_CHAT_TYPING_EVENT, { detail }));
}

export function emitChatJoin(conversationId: number): void {
  if (typeof window === 'undefined') return;
  getSocket().emit('chat:join', { conversationId });
}

export function emitChatLeave(conversationId: number): void {
  if (typeof window === 'undefined') return;
  getSocket().emit('chat:leave', { conversationId });
}

export function emitChatTyping(conversationId: number, typing: boolean): void {
  if (typeof window === 'undefined') return;
  getSocket().emit('chat:typing', { conversationId, typing });
}

export function onTaskChanged(handler: (detail: unknown) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_TASK_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_TASK_EVENT, wrapped);
}

export function onPresenceUpdate(handler: (detail: PresencePayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (lastPresencePayload) handler(lastPresencePayload);
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_PRESENCE_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_PRESENCE_EVENT, wrapped);
}

export function onNotification(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REALTIME_NOTIFICATION_EVENT, handler);
  return () => window.removeEventListener(REALTIME_NOTIFICATION_EVENT, handler);
}

export function onMeRefresh(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(REALTIME_ME_REFRESH_EVENT, handler);
  return () => window.removeEventListener(REALTIME_ME_REFRESH_EVENT, handler);
}

export function onChatUpdate(handler: (detail: ChatUpdatePayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_CHAT_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_CHAT_EVENT, wrapped);
}

export function onChatTyping(handler: (detail: ChatTypingPayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(REALTIME_CHAT_TYPING_EVENT, wrapped);
  return () => window.removeEventListener(REALTIME_CHAT_TYPING_EVENT, wrapped);
}
