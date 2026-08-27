'use client';

import { parseDescription } from '@/lib/descriptionLinks';
import { cn } from '@/lib/utils';

export default function DescriptionContent({
  text,
  className,
  emptyClassName,
}: {
  text?: string | null;
  className?: string;
  emptyClassName?: string;
}) {
  if (!text?.trim()) {
    return <p className={cn('text-sm italic text-muted-foreground', emptyClassName)}>No description</p>;
  }

  const parts = parseDescription(text);

  return (
    <p className={cn('whitespace-pre-wrap text-sm text-muted-foreground', className)}>
      {parts.map((part, i) => {
        if (part.type === 'link') {
          return (
            <a
              key={`${part.href}-${i}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {part.label}
            </a>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </p>
  );
}
