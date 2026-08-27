'use client';

import { cn } from '@/lib/utils';
import type { ChatMentionMember } from '@/lib/chatMentions';

const displayName = (name: string) => name.split(' (')[0] || name;

export default function ChatMentionPicker({
  members,
  highlightIndex,
  onHighlight,
  onSelect,
}: {
  members: ChatMentionMember[];
  highlightIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (member: ChatMentionMember) => void;
}) {
  if (members.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-44 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md"
      role="listbox"
      aria-label="Mention a group member"
    >
      {members.map((member, index) => (
        <button
          key={member.id}
          type="button"
          role="option"
          aria-selected={index === highlightIndex}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
            index === highlightIndex && 'bg-muted',
          )}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
          onClick={() => onSelect(member)}
        >
          <span className="font-medium text-primary">@</span>
          <span className="truncate">{displayName(member.name)}</span>
        </button>
      ))}
    </div>
  );
}
