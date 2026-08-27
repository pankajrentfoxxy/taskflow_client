'use client';

import Link from 'next/link';
import { ChevronRight, MessageCircle, MessageSquare } from 'lucide-react';
import { fmtShortDate, countdown, STATUS_LABEL, STATUS_COLOR, STATUS_COLOR_FALLBACK, SLA_BREACH_BADGE, isTaskOverdue, getTaskRowClasses, canReassignTask, getTaskAssigneeChatHref, getTaskChatLinkTitle, storeTaskForChatAttach } from '@/lib/util';
import { IconClock, IconFlag, IconTag } from './Icons';
import TaskActionsMenu from './TaskActionsMenu';
import TaskDetailAccordion from './TaskDetailAccordion';
import TaskAssignerUrgentBadge from './TaskAssignerUrgentBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const initials = (n?: string) => (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function TaskCard({
  task,
  expanded,
  onToggleExpand,
  onOpenComments,
  onStatusClick,
  onCreateSubtask,
  onTaskDeleted,
  onAssigneeClick,
  renderAction,
  viewer,
}: {
  task: any;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onOpenComments?: (task: any) => void;
  onStatusClick?: (task: any) => void;
  onCreateSubtask?: (task: any) => void;
  onTaskDeleted?: () => void;
  onAssigneeClick?: (task: any) => void;
  renderAction?: (task: any) => React.ReactNode;
  viewer?: { id?: number; role?: string } | null;
}) {
  const overdue = isTaskOverdue(task.due_at, task.status);
  const rowHighlight = getTaskRowClasses(task, viewer);
  const slaRunning = task.status === 'ASSIGNED' && !task.sla_breached_at && task.sla_deadline_at;
  const who = task.assignee_name || (task.team_name ? `Team ${task.team_name}` : 'Unassigned');
  const canEditAssignee = canReassignTask(task, viewer);
  const assigneeChatHref = getTaskAssigneeChatHref(task, viewer?.id);

  return (
    <Card className={cn('gap-0 overflow-hidden py-0 transition-all hover:shadow-[0_4px_12px_rgba(16,24,40,0.07)]', rowHighlight, expanded && 'ring-1 ring-foreground/10')}>
      <CardContent className="p-4">
        <div className="flex gap-1.5">
          {assigneeChatHref && (
            <Link
              href={assigneeChatHref}
              className="mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground/50 outline-none ring-offset-background transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              title={getTaskChatLinkTitle(task, viewer?.id)}
              onClick={() => storeTaskForChatAttach(task)}
            >
              <MessageCircle className="size-4" />
            </Link>
          )}
          {onToggleExpand && (
            <button
              type="button"
              className="group relative mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground/50 outline-none ring-offset-background transition hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
          )}
          <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            title="Change status"
            onClick={() => onStatusClick?.(task)}
          >
            <Badge className={cn('cursor-pointer', STATUS_COLOR[task.status] || STATUS_COLOR_FALLBACK)}>
              <span className="size-1.5 rounded-full bg-current opacity-60" />
              {STATUS_LABEL[task.status] || task.status}
            </Badge>
          </button>
          <TaskAssignerUrgentBadge task={task} viewer={viewer} />
          {task.sla_breached_at && task.status === 'ASSIGNED' && (
            <Badge className={SLA_BREACH_BADGE}>No response</Badge>
          )}
          {slaRunning && (
            <Badge className="status-badge status-assigned">
              <IconClock className="size-3" /> {countdown(task.sla_deadline_at)}
            </Badge>
          )}
          {task.blocked_reason && (
            <Badge className="border-purple-200 bg-purple-50 text-purple-700">Blocked</Badge>
          )}
          {task.type_name && (
            <Badge className="border-gray-200 bg-gray-50 text-gray-500">
              <IconTag className="size-3" /> {task.type_name}
            </Badge>
          )}
          {['URGENT', 'HIGH'].includes(task.priority) && (
            <Badge
              className={
                task.priority === 'URGENT'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-orange-200 bg-orange-50 text-orange-600'
              }
            >
              <IconFlag className="size-3" /> {task.priority.toLowerCase()}
            </Badge>
          )}
        </div>

        <Link href={`/tasks/${task.id}`} className="group block">
          <div className="mt-2 truncate text-[14.5px] font-semibold leading-snug text-gray-900 group-hover:text-brand-700">
            {task.title}
          </div>
        </Link>

        <div className="mt-2.5 flex items-center gap-2">
          {canEditAssignee ? (
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-md outline-none ring-offset-background transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
              title="Change assignee"
              onClick={() => onAssigneeClick?.(task)}
            >
              <Avatar size="sm" className="bg-gradient-to-br from-brand-100 to-violet-100">
                <AvatarFallback className="bg-transparent text-[9px] font-bold text-brand-700">
                  {initials(task.assignee_name || task.team_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-xs text-gray-500">
                {who}
                <span className="mx-1 text-gray-300">·</span>
                <span className="text-gray-400">by {String(task.creator_name || '').split(' (')[0]}</span>
                {task.project_name && (
                  <>
                    <span className="mx-1 text-gray-300">·</span>
                    <span className="font-medium text-brand-600">{task.project_name}</span>
                  </>
                )}
              </span>
            </button>
          ) : (
            <>
              <Avatar size="sm" className="bg-gradient-to-br from-brand-100 to-violet-100">
                <AvatarFallback className="bg-transparent text-[9px] font-bold text-brand-700">
                  {initials(task.assignee_name || task.team_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 truncate text-xs text-gray-500">
                {who}
                <span className="mx-1 text-gray-300">·</span>
                <span className="text-gray-400">by {String(task.creator_name || '').split(' (')[0]}</span>
                {task.project_name && (
                  <>
                    <span className="mx-1 text-gray-300">·</span>
                    <span className="font-medium text-brand-600">{task.project_name}</span>
                  </>
                )}
              </span>
            </>
          )}
        </div>

        <Link href={`/tasks/${task.id}`} className="group block">
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Due </span>
              <span className={cn('font-medium', overdue ? 'text-red-600' : 'text-foreground')}>
                {fmtShortDate(task.due_at)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">ETA </span>
              <span className="font-medium text-foreground">{fmtShortDate(task.eta_at)}</span>
            </div>
          </div>

          {task.subtask_count > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-gray-400">
                  {task.subtask_count} subtask{task.subtask_count > 1 ? 's' : ''}
                </span>
                <span className="tnum font-semibold text-gray-600">
                  {task.subtask_done} of {task.subtask_count} done
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(100 * task.subtask_done) / task.subtask_count}%` }}
                />
              </div>
            </div>
          )}
        </Link>

        {(onOpenComments || renderAction || onCreateSubtask) && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            {onOpenComments ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="relative h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenComments(task)}
              >
                <MessageSquare className="size-4" />
                <span className="ml-1.5">Comments</span>
                {task.comment_count > 0 && (
                  <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {task.comment_count > 9 ? '9+' : task.comment_count}
                  </span>
                )}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1">
              {renderAction?.(task)}
              {onCreateSubtask && (
                <TaskActionsMenu task={task} onCreateSubtask={onCreateSubtask} onDeleted={onTaskDeleted} />
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </CardContent>
      {expanded && onToggleExpand && (
        <TaskDetailAccordion taskId={task.id} onUpdated={onTaskDeleted} />
      )}
    </Card>
  );
}
