'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CommentsPanel from '@/components/CommentsPanel';

export default function CommentsModal({
  task,
  open,
  onClose,
  onChanged,
}: {
  task: { id: number; title?: string } | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton>
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="text-lg font-bold">Comments</DialogTitle>
        </DialogHeader>
        <CommentsPanel taskId={task.id} onChanged={onChanged} className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  );
}
