'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onChatUpdate } from '@/lib/socket';
import { api } from '@/lib/util';
import {
  getChatUnreadEntries,
  getChatUnreadTotal,
  handleChatUpdatePayload,
  markChatConversationRead,
  setActiveChatConversationId,
  setChatPageActive,
  subscribeChatUnread,
  type ChatUnreadEntry,
} from '@/lib/chatUnread';

type ChatUnreadContextValue = {
  chatUnread: number;
  chatEntries: ChatUnreadEntry[];
  setActiveConversation: (id: number | null) => void;
  markConversationRead: (conversationId: number) => void;
  refreshChatUnread: () => void;
};

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

export function useChatUnread() {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    throw new Error('useChatUnread must be used within ChatUnreadProvider');
  }
  return ctx;
}

/** Safe hook for Shell — returns zeros when provider missing */
export function useChatUnreadOptional() {
  return useContext(ChatUnreadContext);
}

export default function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chatUnread, setChatUnread] = useState(0);
  const [chatEntries, setChatEntries] = useState<ChatUnreadEntry[]>([]);
  const meIdRef = { current: null as number | null };

  const refreshChatUnread = useCallback(() => {
    setChatUnread(getChatUnreadTotal());
    setChatEntries(getChatUnreadEntries());
  }, []);

  useEffect(() => {
    refreshChatUnread();
    api('/api/me')
      .then((d) => {
        meIdRef.current = d.user?.id ?? null;
      })
      .catch(() => {});
  }, [refreshChatUnread]);

  useEffect(() => {
    return subscribeChatUnread(refreshChatUnread);
  }, [refreshChatUnread]);

  useEffect(() => {
    const onChat = pathname.startsWith('/chat');
    setChatPageActive(onChat);
    if (!onChat) {
      setActiveChatConversationId(null);
    }
    refreshChatUnread();
  }, [pathname, refreshChatUnread]);

  useEffect(() => {
    return onChatUpdate((payload) => {
      handleChatUpdatePayload(payload, meIdRef.current);
    });
  }, []);

  const setActiveConversation = useCallback((id: number | null) => {
    setActiveChatConversationId(id);
  }, []);

  const markConversationRead = useCallback((conversationId: number) => {
    markChatConversationRead(conversationId);
  }, []);

  return (
    <ChatUnreadContext.Provider
      value={{
        chatUnread,
        chatEntries,
        setActiveConversation,
        markConversationRead,
        refreshChatUnread,
      }}
    >
      {children}
    </ChatUnreadContext.Provider>
  );
}
