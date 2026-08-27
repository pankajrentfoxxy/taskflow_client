'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/Modal';
import { api, toast } from '@/lib/util';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const initials = (n?: string | null) =>
  (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ReassignAssigneeModal({
  task,
  open,
  onClose,
  onDone,
}: {
  task: any | null;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setErr('');
    setBusyId(null);
    api('/api/users')
      .then((d) => setUsers(d.users.filter((u: any) => u.is_active)))
      .catch((e: any) => setErr(e.message));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q),
        )
      : users;
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [users, query]);

  const pick = async (userId: number) => {
    if (!task || busyId) return;
    setErr('');
    setBusyId(userId);
    try {
      await api(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reassign', assigneeId: userId }),
      });
      toast.success('Assignee updated');
      onDone?.();
      onClose();
    } catch (e: any) {
      setErr(e.message);
      toast.errorFrom(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change assignee">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select who should work on{' '}
          <span className="font-medium text-foreground">{task?.title}</span>.
          The task goes back to <span className="font-medium">Assigned</span> for the new person.
        </p>
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10"
          autoFocus
        />
        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            filtered.map((u) => {
              const isCurrent = task?.assignee_id === u.id;
              const loading = busyId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={!!busyId || isCurrent}
                  onClick={() => pick(u.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition',
                    isCurrent
                      ? 'cursor-default bg-muted/60 opacity-70'
                      : 'hover:bg-muted',
                    loading && 'opacity-60',
                  )}
                >
                  <Avatar className="size-8 bg-muted">
                    <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                      {initials(u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  {isCurrent && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">Current</span>
                  )}
                  {loading && (
                    <span className="shrink-0 text-xs text-muted-foreground">Saving…</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
