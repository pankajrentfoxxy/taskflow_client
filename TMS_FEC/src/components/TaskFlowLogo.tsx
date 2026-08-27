import { cn } from '@/lib/utils';

export default function TaskFlowLogo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt="TaskFlow"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-lg', className)}
    />
  );
}
