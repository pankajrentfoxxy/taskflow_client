'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { TaskDueDateFilterMode } from '@/lib/util';
import { cn } from '@/lib/utils';

export type OnlineUser = { id: number; name: string };

export default function TaskDateRangeFilter({
  mode,
  fromDate,
  toDate,
  onModeChange,
  onFromDateChange,
  onToDateChange,
  onReset,
  showReset = false,
  onlineCount,
  onlineUsers = [],
  userChatHref,
  className,
}: {
  mode: TaskDueDateFilterMode;
  fromDate: string;
  toDate: string;
  onModeChange: (mode: TaskDueDateFilterMode) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onReset?: () => void;
  showReset?: boolean;
  onlineCount?: number | null;
  onlineUsers?: OnlineUser[];
  /** When set, each online user links to their chat (e.g. admin dashboard). */
  userChatHref?: (user: OnlineUser) => string;
  className?: string;
}) {
  const [onlineOpen, setOnlineOpen] = useState(false);

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'today' as const, label: 'Today' },
            { key: 'range' as const, label: 'Date range' },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.key}
            type="button"
            size="sm"
            variant={mode === opt.key ? 'default' : 'outline'}
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onModeChange(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
        {onlineCount != null && (
          <div
            className="relative"
            onMouseEnter={() => setOnlineOpen(true)}
            onMouseLeave={() => setOnlineOpen(false)}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              tabIndex={-1}
              aria-live="polite"
              aria-expanded={onlineOpen}
              className="h-8 cursor-default rounded-full px-3 text-xs font-normal text-muted-foreground hover:bg-background"
            >
              <span className="relative mr-1.5 flex size-2 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {onlineCount} user{onlineCount === 1 ? '' : 's'} online
            </Button>
            {onlineOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-border bg-popover p-1 shadow-md">
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Online now
                </div>
                {onlineUsers.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">No one else online</div>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {onlineUsers.map((user) => {
                      const label = (
                        <>
                          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span className="truncate">{user.name.split(' (')[0]}</span>
                        </>
                      );
                      return (
                        <li key={user.id}>
                          {userChatHref ? (
                            <Link
                              href={userChatHref(user)}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted"
                              onClick={() => setOnlineOpen(false)}
                            >
                              {label}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground">
                              {label}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {mode === 'range' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            aria-label="Due from date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 w-full min-w-[140px] sm:w-auto"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => onToDateChange(e.target.value)}
            aria-label="Due to date"
          />
        </div>
      )}
      {showReset && onReset && (
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-muted-foreground" onClick={onReset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}
