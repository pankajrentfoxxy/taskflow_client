'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api, timeAgo, toast } from '@/lib/util';
import { onNotification } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { ChatUnreadEntry } from '@/lib/chatUnread';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const ICONS: Record<string, string> = {
  ASSIGNED: '📥',
  DISCUSS: '💬',
  REJECTED: '✖️',
  SLA_WARNING: '⏰',
  SLA_BREACH: '🚨',
  ESCALATED: '🔺',
  EXPLANATION: '📝',
  REVIEW: '⚖️',
  DONE: '✅',
  SUBTASK_DONE: '☑️',
  COMMENT: '💬',
  ETA_CHANGED: '🕒',
  DUE_CHANGED: '📅',
  DUE_SOON: '⏳',
  REOPENED: '↩️',
  CANCELLED: '🚫',
  BLOCKED: '🚧',
  ACKNOWLEDGED: '👍',
  PROJECT: '📁',
  SUBTASK: '➕',
};

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body?: string | null;
  task_id?: number | null;
  read_at?: string | null;
  created_at: string;
};

export default function NotificationMenu({
  unread,
  chatUnread = 0,
  chatEntries = [],
  refreshMe,
  onOpenChat,
}: {
  unread: number;
  chatUnread?: number;
  chatEntries?: ChatUnreadEntry[];
  refreshMe: () => void;
  onOpenChat?: (conversationId: number) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const totalUnread = unread + chatUnread;

  const load = useCallback(() => {
    setLoading(true);
    return api('/api/notifications')
      .then((d) => setItems(d.notifications ?? []))
      .catch((e) => toast.errorFrom(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => onNotification(() => {
    if (open) void load();
    refreshMe();
  }), [open, load, refreshMe]);

  useEffect(() => {
    const onChatUnread = () => {
      if (open) refreshMe();
    };
    window.addEventListener('tf:chat-unread-changed', onChatUnread);
    return () => window.removeEventListener('tf:chat-unread-changed', onChatUnread);
  }, [open, refreshMe]);

  const afterAction = (message: string) => {
    void load();
    refreshMe();
    toast.success(message);
  };

  const markAll = () =>
    api('/api/notifications', { method: 'POST', body: JSON.stringify({ all: true }) })
      .then(() => afterAction('All notifications marked read'))
      .catch((e) => toast.errorFrom(e));

  const clearAll = () =>
    api('/api/notifications/clear', { method: 'POST' })
      .then(() => afterAction('Notifications cleared'))
      .catch((e) => toast.errorFrom(e));

  const openNotification = (n: NotificationItem) => {
    api('/api/notifications', { method: 'POST', body: JSON.stringify({ ids: [n.id] }) })
      .then(() => refreshMe())
      .catch(() => {});
    setOpen(false);
    if (n.task_id) router.push(`/tasks/${n.task_id}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-foreground px-0.5 text-[9px] font-bold text-background">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            {totalUnread > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {totalUnread} unread
                {chatUnread > 0 && unread > 0
                  ? ` · ${chatUnread} chat`
                  : chatUnread > 0
                    ? ' · chat'
                    : ''}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-xs"
              onClick={markAll}
              disabled={items.length === 0}
            >
              Mark read
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={clearAll}
              disabled={items.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[min(24rem,60vh)]">
          <div className="p-1">
            {chatEntries.length > 0 && (
              <div className="mb-1">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Chat
                </div>
                {chatEntries.map((entry) => (
                  <button
                    key={`chat-${entry.conversationId}`}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (onOpenChat) onOpenChat(entry.conversationId);
                      else router.push(`/chat?conversationId=${entry.conversationId}`);
                    }}
                    className="flex w-full gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-muted/70 bg-brand-50/60"
                  >
                    <span className="shrink-0 text-lg leading-none">💬</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold">{entry.name}</div>
                        {entry.count > 1 && (
                          <span className="shrink-0 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                            {entry.count > 9 ? '9+' : entry.count}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{entry.preview}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {chatEntries.length > 0 && items.length > 0 && (
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tasks
              </div>
            )}

            {loading && items.length === 0 && chatEntries.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!loading && items.length === 0 && chatEntries.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications.</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={cn(
                  'flex w-full gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-muted/70',
                  !n.read_at && 'bg-brand-50/60 hover:bg-brand-50'
                )}
              >
                <span className="shrink-0 text-lg leading-none">{ICONS[n.type] || '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <div className={cn('text-sm leading-snug', !n.read_at && 'font-semibold')}>{n.title}</div>
                  {n.body && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground/80">{timeAgo(n.created_at)}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
