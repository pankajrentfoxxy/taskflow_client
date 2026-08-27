'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TaskPaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function TaskPagination({
  pagination,
  onPageChange,
  loading,
  className,
}: {
  pagination: TaskPaginationMeta;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}) {
  const { page, limit, total, totalPages } = pagination;
  if (total <= limit && page === 1) return null;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-4', className)}>
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="tnum min-w-[5rem] text-center text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
