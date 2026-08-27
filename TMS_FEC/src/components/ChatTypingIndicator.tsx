'use client';

const stripParen = (name: string) => name.split(' (')[0] || name;

function typingLabel(names: string[]): string {
  if (names.length === 1) return `${stripParen(names[0])} is typing`;
  if (names.length === 2) return `${stripParen(names[0])} and ${stripParen(names[1])} are typing`;
  return 'Several people are typing';
}

export default function ChatTypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div className="flex items-end gap-2 py-1" aria-live="polite" aria-label={typingLabel(names)}>
      <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 shadow-sm">
        <span className="chat-typing-dot" aria-hidden />
        <span className="chat-typing-dot chat-typing-dot-delay-1" aria-hidden />
        <span className="chat-typing-dot chat-typing-dot-delay-2" aria-hidden />
      </div>
      <span className="pb-1 text-[11px] text-muted-foreground">{typingLabel(names)}</span>
    </div>
  );
}
