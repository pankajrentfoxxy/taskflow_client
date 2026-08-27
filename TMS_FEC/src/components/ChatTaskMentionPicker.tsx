'use client';

import { cn } from '@/lib/utils';
import { STATUS_LABEL } from '@/lib/util';
import type { ChatTaskMention } from '@/lib/chatTaskMentions';
import { ListTodo } from 'lucide-react';

export default function ChatTaskMentionPicker({
  tasks,
  highlightIndex,
  onHighlight,
  onSelect,
}: {
  tasks: ChatTaskMention[];
  highlightIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (task: ChatTaskMention) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-52 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md"
      role="listbox"
      aria-label="Link a task"
    >
      {tasks.map((task, index) => (
        <button
          key={task.id}
          type="button"
          role="option"
          aria-selected={index === highlightIndex}
          className={cn(
            'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
            index === highlightIndex && 'bg-muted',
          )}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelect(task)}
        >
          <ListTodo className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              <span className="text-muted-foreground">#{task.id}</span> {task.title || 'Task'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {STATUS_LABEL[task.status || ''] || task.status || 'Task'}
              {task.assignee_name ? ` · ${task.assignee_name}` : ''}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
