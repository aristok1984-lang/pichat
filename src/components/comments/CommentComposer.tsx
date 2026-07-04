'use client';

import React, { useState, useRef, useEffect } from 'react';
import AppImage from '@/components/ui/AppImage';

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

interface CommentComposerProps {
  currentUserId: string;
  currentUserProfile: { avatar_url?: string | null; display_name?: string; username?: string } | null;
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  replyingTo?: string;
  onCancelReply?: () => void;
  autoFocus?: boolean;
}

export default function CommentComposer({
  currentUserId,
  currentUserProfile,
  onSubmit,
  placeholder = 'Add a comment…',
  replyingTo,
  onCancelReply,
  autoFocus = false,
}: CommentComposerProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const avatarColor = getAvatarColor(currentUserId);
  const initials = (currentUserProfile?.display_name || currentUserProfile?.username || 'U')
    .charAt(0)
    .toUpperCase();

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className="flex gap-2.5"
      style={{ padding: replyingTo ? '8px 0 0 0' : '12px 12px 0 12px' }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden mt-0.5"
        style={{ background: currentUserProfile?.avatar_url ? 'transparent' : avatarColor }}
      >
        {currentUserProfile?.avatar_url ? (
          <AppImage
            src={currentUserProfile.avatar_url}
            alt={currentUserProfile.display_name || 'You'}
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Input area */}
      <div className="flex-1 min-w-0">
        {replyingTo && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ color: '#7C8FA3', fontSize: '11px' }}>
              Replying to{' '}
              <span style={{ color: '#2A97DF', fontWeight: 600 }}>@{replyingTo}</span>
            </span>
            {onCancelReply && (
              <button
                onClick={onCancelReply}
                style={{ color: '#7C8FA3', fontSize: '11px' }}
                className="hover:opacity-70 transition-opacity"
              >
                · Cancel
              </button>
            )}
          </div>
        )}
        <div
          className="flex items-end gap-2"
          style={{
            background: '#1E2C3A',
            border: '0.7px solid rgba(42,58,74,0.9)',
            borderRadius: '2px',
            padding: '8px 10px',
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none outline-none bg-transparent"
            style={{
              color: '#E8EDF2',
              fontSize: '13px',
              lineHeight: '1.5',
              minHeight: '20px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="shrink-0 flex items-center justify-center transition-all"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '2px',
              background: text.trim() && !submitting ? '#2A97DF' : 'rgba(42,151,223,0.2)',
              color: text.trim() && !submitting ? '#fff' : '#4A6A8A',
            }}
          >
            {submitting ? (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                <path d="M21 12a9 9 0 00-9-9" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p style={{ color: '#4A6A8A', fontSize: '10px', marginTop: '4px' }}>
          Ctrl+Enter to submit
        </p>
      </div>
    </div>
  );
}
