'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flag, MessageCircle, MessageSquare, User } from 'lucide-react';
import { STATUS_LABEL, STATUS_COLOR, STATUS_COLOR_FALLBACK, STATUS_DOT, PRIORITY_COLOR, fmtShortDate, isTaskOverdue, getTaskRowClasses, canReassignTask, getTaskAssigneeChatHref, getTaskChatLinkTitle, storeTaskForChatAttach } from '@/lib/util';
import { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import TaskStatusModal from '@/components/TaskStatusModal';
import TaskActionsMenu from '@/components/TaskActionsMenu';
import TaskDetailAccordion from '@/components/TaskDetailAccordion';
import TaskAssignerUrgentBadge from '@/components/TaskAssignerUrgentBadge';
import ReassignAssigneeModal from '@/components/ReassignAssigneeModal';
import Composer from '@/components/Composer';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const initials = (n?: string | null) =>
  (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function TaskRow({
  task,
  expanded,
  onToggleExpand,
  colSpan,
  onOpenComments,
  onStatusClick,
  onCreateSubtask,
  onTaskDeleted,
  renderAction,
  onAssigneeClick,
  viewer,
}: {
  task: any;
  expanded: boolean;
  onToggleExpand: () => void;
  colSpan: number;
  onOpenComments: (task: any) => void;
  onStatusClick: (task: any) => void;
  onCreateSubtask: (task: any) => void;
  onTaskDeleted?: () => void;
  renderAction?: (task: any) => React.ReactNode;
  onAssigneeClick?: (task: any) => void;
  viewer?: { id?: number; role?: string } | null;
}) {
  const overdue = isTaskOverdue(task.due_at, task.status);
  const rowHighlight = getTaskRowClasses(task, viewer);
  const assignee = task.assignee_name || (task.team_name ? `Team ${task.team_name}` : null);
  const canEditAssignee = canReassignTask(task, viewer);
  const memberBadge =
    task.member_count > 0 ? (
      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        +{task.member_count}
      </span>
    ) : null;
  const assigneeChatHref = getTaskAssigneeChatHref(task, viewer?.id);

  return (
    <>
    <TableRow className={cn('group', rowHighlight, expanded && 'ring-1 ring-inset ring-foreground/5')}>
      <TableCell className="min-w-[280px] max-w-[420px] whitespace-normal py-3 pl-3">
        <div className="flex items-center gap-1.5">
          {assigneeChatHref && (
            <Link
              href={assigneeChatHref}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground/50 outline-none ring-offset-background transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              title={getTaskChatLinkTitle(task, viewer?.id)}
              onClick={(e) => {
                e.stopPropagation();
                storeTaskForChatAttach(task);
              }}
            >
              <MessageCircle className="size-4" />
            </Link>
          )}
          <button
            type="button"
            className="group relative shrink-0 rounded-md p-0.5 text-muted-foreground/50 outline-none ring-offset-background transition hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
            onClick={onToggleExpand}
          >
            {task.subtask_count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 z-10 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-background">
                {task.subtask_count > 9 ? '9+' : task.subtask_count}
              </span>
            )}
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                expanded && 'rotate-90 text-muted-foreground',
                !expanded && task.subtask_count > 0 && 'text-muted-foreground group-hover:translate-x-0.5'
              )}
            />
          </button>
          <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[task.status] || 'status-dot-cancelled')} />
            <span className="truncate font-medium text-foreground group-hover:text-primary">{task.title}</span>
          </Link>
        </div>
      </TableCell>

      <TableCell className="py-3">
        {assignee ? (
          canEditAssignee ? (
            <button
              type="button"
              className="flex items-center gap-2 rounded-md outline-none ring-offset-background transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
              title="Change assignee"
              onClick={() => onAssigneeClick?.(task)}
            >
              <Avatar className="size-7 bg-muted">
                <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                  {initials(task.assignee_name || task.team_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm text-muted-foreground xl:inline">
                {assignee.split(' (')[0]}
              </span>
              {memberBadge}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Avatar className="size-7 bg-muted">
                <AvatarFallback className="bg-muted text-[10px] font-semibold text-muted-foreground">
                  {initials(task.assignee_name || task.team_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm text-muted-foreground xl:inline">
                {assignee.split(' (')[0]}
              </span>
              {memberBadge}
            </div>
          )
        ) : canEditAssignee ? (
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground/60 outline-none ring-offset-background transition hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            title="Assign someone"
            onClick={() => onAssigneeClick?.(task)}
          >
            <User className="size-5" />
          </button>
        ) : (
          <User className="size-5 text-muted-foreground/60" />
        )}
      </TableCell>

      <TableCell className={cn('py-3 text-sm', overdue ? 'font-medium text-red-600' : 'text-muted-foreground')}>
        {fmtShortDate(task.due_at)}
      </TableCell>

      <TableCell className="py-3 text-sm text-muted-foreground">
        {fmtShortDate(task.eta_at)}
      </TableCell>

      <TableCell className="max-w-[140px] truncate py-3 text-sm text-muted-foreground">
        {task.type_name || '—'}
      </TableCell>

      <TableCell className="py-3">
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium capitalize', PRIORITY_COLOR[task.priority])}>
          <Flag className="size-3.5 fill-current" />
          {task.priority.toLowerCase()}
        </span>
      </TableCell>

      <TableCell className="py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            title="Change status"
            onClick={() => onStatusClick(task)}
          >
            <Badge className={cn('cursor-pointer', STATUS_COLOR[task.status] || STATUS_COLOR_FALLBACK)}>
              <span className="mr-1.5 size-1.5 rounded-full bg-current opacity-70" />
              {STATUS_LABEL[task.status] || task.status}
            </Badge>
          </button>
          <TaskAssignerUrgentBadge task={task} viewer={viewer} />
        </div>
      </TableCell>

      <TableCell className={cn('hidden py-3 md:table-cell', !renderAction && 'pr-3')}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground hover:text-foreground"
          onClick={() => onOpenComments(task)}
          title="Comments"
        >
          <MessageSquare className="size-4" />
          {task.comment_count > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {task.comment_count > 9 ? '9+' : task.comment_count}
            </span>
          )}
        </Button>
      </TableCell>
      <TableCell className={cn('py-3 text-right', renderAction ? '' : 'pr-3')}>
        <TaskActionsMenu task={task} onCreateSubtask={onCreateSubtask} onDeleted={onTaskDeleted} />
      </TableCell>
      {renderAction && (
        <TableCell className="py-3 pr-3 text-right">{renderAction(task)}</TableCell>
      )}
    </TableRow>
    {expanded && (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="p-0">
          <TaskDetailAccordion taskId={task.id} onUpdated={onTaskDeleted} />
        </TableCell>
      </TableRow>
    )}
    </>
  );
}

export default function TaskTable({
  tasks,
  onOpenComments,
  onTaskUpdated,
  renderAction,
}: {
  tasks: any[];
  onOpenComments: (task: any) => void;
  onTaskUpdated?: () => void;
  renderAction?: (task: any) => React.ReactNode;
}) {
  const [statusTask, setStatusTask] = useState<any>(null);
  const [subtaskParent, setSubtaskParent] = useState<any>(null);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const me = useMe();
  const viewer = me ? { id: me.id, role: me.role } : null;
  const colSpan = renderAction ? 10 : 9;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            viewer={viewer}
            expanded={expandedId === task.id}
            onToggleExpand={() => setExpandedId((id) => (id === task.id ? null : task.id))}
            onOpenComments={onOpenComments}
            onStatusClick={setStatusTask}
            onCreateSubtask={setSubtaskParent}
            onTaskDeleted={onTaskUpdated}
            onAssigneeClick={setReassignTask}
            renderAction={renderAction}
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/5 md:block">
        <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-11 pl-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assignee</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Due date</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ETA</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task type</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</TableHead>
            <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
            <TableHead className="hidden h-11 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:table-cell">Comments</TableHead>
            <TableHead className="h-11 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Action</TableHead>
            {renderAction && (
              <TableHead className="h-11 w-36 pr-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              expanded={expandedId === task.id}
              onToggleExpand={() => setExpandedId((id) => (id === task.id ? null : task.id))}
              colSpan={colSpan}
              onOpenComments={onOpenComments}
              onStatusClick={setStatusTask}
              onCreateSubtask={setSubtaskParent}
              onTaskDeleted={onTaskUpdated}
              onAssigneeClick={setReassignTask}
              renderAction={renderAction}
              viewer={viewer}
            />
          ))}
        </TableBody>
        </Table>
      </div>

      <TaskStatusModal
        task={statusTask}
        open={!!statusTask}
        onClose={() => setStatusTask(null)}
        onDone={() => onTaskUpdated?.()}
      />
      <ReassignAssigneeModal
        task={reassignTask}
        open={!!reassignTask}
        onClose={() => setReassignTask(null)}
        onDone={() => onTaskUpdated?.()}
      />
      <Composer
        open={!!subtaskParent}
        onClose={() => setSubtaskParent(null)}
        onCreated={() => {
          setSubtaskParent(null);
          onTaskUpdated?.();
        }}
        presetParentId={subtaskParent?.id ?? null}
        presetProjectId={subtaskParent?.project_id ?? null}
      />
    </>
  );
}

export function TaskTableSkeleton() {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/5 md:block">
      <div className="space-y-0">
        <div className="h-11 border-b bg-muted/30" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex h-14 items-center gap-4 border-b px-3 last:border-0">
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
