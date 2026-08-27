'use client';

import { Toaster } from '@/components/ui/sonner';
import RealtimeProvider from '@/components/RealtimeProvider';
import ChatUnreadProvider from '@/components/ChatUnreadProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <ChatUnreadProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </ChatUnreadProvider>
    </RealtimeProvider>
  );
}
