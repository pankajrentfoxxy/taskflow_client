'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emitChatJoin, emitChatLeave, emitChatTyping, getSocket, onChatTyping } from '@/lib/socket';

const EMIT_INTERVAL_MS = 2500;
const IDLE_STOP_MS = 3000;
const REMOTE_TTL_MS = 4500;

/** Throttled socket typing indicator — join conv room once, emit sparingly while typing. */
export function useChatTyping(
  conversationId: number | null,
  text: string,
  myUserId: number | undefined,
) {
  const [typingUserNames, setTypingUserNames] = useState<string[]>([]);
  const typersRef = useRef<Map<number, { name: string; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const lastEmitRef = useRef(0);
  const idleStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const convIdRef = useRef(conversationId);
  convIdRef.current = conversationId;

  const syncTypers = useCallback(() => {
    setTypingUserNames([...typersRef.current.values()].map((v) => v.name));
  }, []);

  const stopTyping = useCallback(() => {
    if (idleStopRef.current) {
      clearTimeout(idleStopRef.current);
      idleStopRef.current = null;
    }
    if (!isTypingRef.current || !convIdRef.current) return;
    emitChatTyping(convIdRef.current, false);
    isTypingRef.current = false;
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSocket();
    const join = () => emitChatJoin(conversationId);
    join();
    typersRef.current.forEach((entry) => clearTimeout(entry.timer));
    typersRef.current.clear();
    syncTypers();
    socket.on('connect', join);
    return () => {
      stopTyping();
      emitChatLeave(conversationId);
      socket.off('connect', join);
    };
  }, [conversationId, stopTyping, syncTypers]);

  useEffect(() => {
    if (!myUserId) return;
    return onChatTyping((payload) => {
      if (payload.conversationId !== convIdRef.current) return;
      if (payload.userId === myUserId) return;

      const existing = typersRef.current.get(payload.userId);
      if (existing) clearTimeout(existing.timer);

      if (!payload.typing) {
        typersRef.current.delete(payload.userId);
        syncTypers();
        return;
      }

      const timer = setTimeout(() => {
        typersRef.current.delete(payload.userId);
        syncTypers();
      }, REMOTE_TTL_MS);

      typersRef.current.set(payload.userId, { name: payload.userName, timer });
      syncTypers();
    });
  }, [myUserId, syncTypers]);

  useEffect(() => {
    if (!conversationId) return;
    const hasText = text.trim().length > 0;
    if (!hasText) {
      stopTyping();
      return;
    }

    const now = Date.now();
    if (!isTypingRef.current || now - lastEmitRef.current >= EMIT_INTERVAL_MS) {
      emitChatTyping(conversationId, true);
      isTypingRef.current = true;
      lastEmitRef.current = now;
    }

    if (idleStopRef.current) clearTimeout(idleStopRef.current);
    idleStopRef.current = setTimeout(stopTyping, IDLE_STOP_MS);

    return () => {
      if (idleStopRef.current) {
        clearTimeout(idleStopRef.current);
        idleStopRef.current = null;
      }
    };
  }, [text, conversationId, stopTyping]);

  return { typingUserNames };
}
