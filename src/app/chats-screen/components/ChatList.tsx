'use client';

import React from 'react';
import ChatRow from './ChatRow';

export interface ChatItem {
  id: string;
  name: string;
  avatar: string;
  avatarColor: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean;
  isGroup: boolean;
  isMuted: boolean;
  pinned: boolean;
  isVerified: boolean;
  isMentioned: boolean;
  hasStory: boolean;
  lastMessageSelf: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
}

interface ChatListProps {
  chats: ChatItem[];
  onSelectChat: (chat: ChatItem) => void;
  searchQuery: string;
}

export default function ChatList({ chats, onSelectChat, searchQuery }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--muted)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-foreground mb-1">
          {searchQuery ? `No results for "${searchQuery}"` : 'No conversations yet'}
        </p>
        <p className="text-sm text-muted-foreground">
          {searchQuery
            ? 'Try searching for a different name or message'
            : 'Start a new chat by tapping the compose button'}
        </p>
      </div>
    );
  }

  // Group: pinned chats first
  const pinned = chats.filter((c) => c.pinned);
  const regular = chats.filter((c) => !c.pinned);

  return (
    <div className="py-2 px-2">
      {pinned.length > 0 && (
        <>
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pinned
          </p>
          {pinned.map((chat) => (
            <ChatRow key={`chat-${chat.id}`} chat={chat} onClick={() => onSelectChat(chat)} />
          ))}
          <div className="h-px mx-2 my-2" style={{ background: 'var(--border)' }} />
        </>
      )}
      {regular.map((chat) => (
        <ChatRow key={`chat-${chat.id}`} chat={chat} onClick={() => onSelectChat(chat)} />
      ))}
    </div>
  );
}