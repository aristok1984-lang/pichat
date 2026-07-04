'use client';

import React from 'react';
import { ChatItem } from './ChatList';
import AppImage from '@/components/ui/AppImage';

interface ChatRowProps {
  chat: ChatItem;
  onClick: () => void;
}

export default function ChatRow({ chat, onClick }: ChatRowProps) {
  return (
    <div className="chat-row" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={chat.hasStory ? 'story-ring-active story-pulse' : ''}>
          <div
            className="w-12 h-12 rounded-full overflow-hidden"
            style={{ background: 'var(--muted)' }}
          >
            {chat.avatar ? (
              <AppImage
                src={chat.avatar}
                alt={`${chat.name} profile photo`}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-lg font-bold"
                style={{ background: chat.avatarColor, color: 'white' }}
              >
                {chat.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {chat.isOnline && (
          <span className="online-dot absolute bottom-0 right-0" />
        )}
        {chat.isGroup && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)', border: '2px solid var(--background)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {chat.pinned && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--muted-foreground)">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            <span className="text-sm font-semibold text-foreground truncate">{chat.name}</span>
            {chat.isVerified && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
              </svg>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-tabular shrink-0 ml-2">{chat.timestamp}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {chat.isTyping ? (
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>typing</span>
                <div className="flex gap-0.5 items-end">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            ) : (
              <>
                {chat.lastMessageSelf && (
                  <DeliveryStatus status={chat.deliveryStatus} />
                )}
                <span className="text-xs text-muted-foreground truncate">{chat.lastMessage}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {chat.isMuted && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--muted-foreground)">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" />
                <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
            {chat.unreadCount > 0 && (
              <span className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>
            )}
            {chat.unreadCount === 0 && chat.isMentioned && (
              <span className="unread-badge" style={{ background: 'var(--accent)' }}>@</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryStatus({ status }: { status?: string }) {
  if (status === 'read') {
    return (
      <svg width="14" height="10" viewBox="0 0 16 10" fill="none" className="shrink-0 message-check-delivered">
        <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg width="14" height="10" viewBox="0 0 16 10" fill="none" className="shrink-0 message-check-sent">
        <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'sent') {
    return (
      <svg width="10" height="10" viewBox="0 0 12 10" fill="none" className="shrink-0 message-check-sent">
        <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}