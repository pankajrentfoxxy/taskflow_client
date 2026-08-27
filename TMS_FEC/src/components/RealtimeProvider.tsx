'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
  connectSocket,
  releaseSocket,
  disconnectSocket,
  dispatchNotification,
  dispatchPresence,
  dispatchTaskChanged,
  dispatchMeRefresh,
  dispatchChatUpdate,
  dispatchChatTyping,
} from '@/lib/socket';
import { api, toast } from '@/lib/util';

type Me = {
  id: number;
  role: string;
};

/** Keeps one socket connection for the whole app (survives page navigations). */
export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(() => {
    return api('/api/me')
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/login')) {
      setMe(null);
      disconnectSocket();
      return;
    }
    void loadMe();
  }, [pathname, loadMe]);

  useEffect(() => {
    if (!me) return;

    const socket = connectSocket();
    const isAdmin = ['ADMIN', 'CEO'].includes(me.role);

    const onNotify = (payload: { notification?: { title?: string; body?: string } }) => {
      dispatchMeRefresh();
      dispatchNotification(payload);
      if (!isAdmin) {
        const title = payload?.notification?.title;
        if (title) toast.info(title);
      }
    };

    const onAdminNotify = (payload: { title?: string; body?: string }) => {
      if (!isAdmin) return;
      dispatchMeRefresh();
      dispatchNotification(payload);
      if (payload?.title) toast.info(payload.title);
    };

    const onTaskChanged = (payload: unknown) => {
      dispatchTaskChanged(payload);
    };

    const onPresence = (payload: unknown) => {
      dispatchPresence(payload);
    };

    const onChatUpdate = (payload: unknown) => {
      dispatchChatUpdate(payload as Parameters<typeof dispatchChatUpdate>[0]);
    };

    const onChatTyping = (payload: unknown) => {
      dispatchChatTyping(payload as Parameters<typeof dispatchChatTyping>[0]);
    };

    const onConnectError = (err: Error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[socket] connect_error', err.message);
      }
    };

    socket.on('notification:new', onNotify);
    socket.on('admin:notification', onAdminNotify);
    socket.on('task:changed', onTaskChanged);
    socket.on('presence:update', onPresence);
    socket.on('chat:update', onChatUpdate);
    socket.on('chat:typing', onChatTyping);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('notification:new', onNotify);
      socket.off('admin:notification', onAdminNotify);
      socket.off('task:changed', onTaskChanged);
      socket.off('presence:update', onPresence);
      socket.off('chat:update', onChatUpdate);
      socket.off('chat:typing', onChatTyping);
      socket.off('connect_error', onConnectError);
      releaseSocket();
    };
  }, [me]);

  return children;
}
