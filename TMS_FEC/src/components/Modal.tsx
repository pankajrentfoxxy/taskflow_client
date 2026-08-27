'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className={`flex max-h-[92vh] w-full flex-col gap-0 overflow-visible p-0 ${wide ? 'max-w-5xl sm:max-w-5xl' : 'max-w-lg sm:max-w-lg'}`}
        showCloseButton
      >
        <DialogHeader className="sticky top-0 z-10 shrink-0 border-b bg-background px-5 py-3.5">
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
