'use client';

import { useState } from 'react';
import { MoreVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMe } from '@/components/Shell';
import { api, toast } from '@/lib/util';

export function canCreateSubtask(task: { parent_id?: number | null; status?: string }) {
  return !task.parent_id && !['DONE', 'CANCELLED', 'REJECTED'].includes(task.status || '');
}

export function canDeleteTask(role?: string) {
  return role === 'ADMIN' || role === 'CEO';
}

function runAfterMenuClose(action: () => void) {
  window.setTimeout(action, 0);
}

export default function TaskActionsMenu({
  task,
  onCreateSubtask,
  onDeleted,
}: {
  task: any;
  onCreateSubtask: (task: any) => void;
  onDeleted?: () => void;
}) {
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const subtaskAllowed = canCreateSubtask(task);
  const deleteAllowed = canDeleteTask(me?.role);

  const closeMenuThen = (action: () => void) => {
    setMenuOpen(false);
    runAfterMenuClose(action);
  };

  const handleDelete = async () => {
    if (!deleteAllowed || busy) return;
    const ok = window.confirm(`Delete "${task.title}"? This hides the task and its subtasks from the app.`);
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      toast.success('Task deleted');
      onDeleted?.();
    } catch (e: unknown) {
      toast.errorFrom(e, 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          title="Actions"
          disabled={busy}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {subtaskAllowed ? (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              closeMenuThen(() => onCreateSubtask(task));
            }}
          >
            <Plus className="size-4" />
            Create subtask
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Create subtask</DropdownMenuItem>
        )}
        {deleteAllowed && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                closeMenuThen(handleDelete);
              }}
            >
              <Trash2 className="size-4" />
              Delete task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
