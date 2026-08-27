'use client';

import { taskNeedsAssignerActionForViewer } from '@/lib/util';
import { cn } from '@/lib/utils';

export const TASK_ASSIGNER_URGENT_LABEL = 'Action needed';

export default function TaskAssignerUrgentBadge({
  task,
  viewer,
  className,
}: {
  task: {
    creator_id?: number;
    status?: string;
    blocked_reason?: string | null;
    escalation_review_pending?: boolean | string | null;
  };
  viewer?: { id?: number; role?: string } | null;
  className?: string;
}) {
  if (!taskNeedsAssignerActionForViewer(task, viewer)) return null;

  return (
    <span className={cn('task-urgent-notice', className)} role="status">
      {TASK_ASSIGNER_URGENT_LABEL}
    </span>
  );
}
