'use client';

import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import CommentComposer from './CommentComposer';
import { Comment } from './types';

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

const MAX_DEPTH_INDENT = 4;

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  currentUserProfile: { avatar_url?: string | null; display_name?: string; username?: string } | null;
  onReply: (parentId: string, content: string) => Promise<void>;
  onLike: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  depth?: number;
}

export default function CommentItem({
  comment,
  currentUserId,
  currentUserProfile,
  onReply,
  onLike,
  onEdit,
  onDelete,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const author = comment.user_profiles;
  const username = author?.username || 'unknown';
  const displayName = author?.display_name || username;
  const avatarColor = getAvatarColor(comment.author_id);
  const isOwner = currentUserId === comment.author_id;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const indentLevel = Math.min(depth, MAX_DEPTH_INDENT);

  async function handleEditSave() {
    const trimmed = editText.trim();
    if (!trimmed || savingEdit) return;
    setSavingEdit(true);
    try {
      await onEdit(comment.id, trimmed);
      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  }

  if (comment.is_deleted && (!comment.replies || comment.replies.length === 0)) {
    return null;
  }

  return (
    <div
      className="relative"
      style={{
        paddingLeft: indentLevel > 0 ? `${indentLevel * 16}px` : '0',
      }}
    >
      {/* Thread line for nested comments */}
      {indentLevel > 0 && (
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${(indentLevel - 1) * 16 + 11}px`,
            width: '1px',
            background: 'rgba(42,58,74,0.6)',
          }}
        />
      )}

      <div className="relative">
        {/* Comment header */}
        <div className="flex items-start gap-2 py-2">
          {/* Avatar + collapse button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0 relative group"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
              style={{ background: author?.avatar_url ? 'transparent' : avatarColor }}
            >
              {author?.avatar_url ? (
                <AppImage
                  src={author.avatar_url}
                  alt={displayName}
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              ) : (
                comment.is_deleted ? '?' : displayName.charAt(0).toUpperCase()
              )}
            </div>
            {/* Collapse indicator */}
            {isCollapsed && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                style={{ background: '#2A97DF' }}
              >
                <svg width="6" height="6" viewBox="0 0 24 24" fill="white">
                  <path d="M12 5v14M5 12l7 7 7-7" stroke="white" strokeWidth="3" fill="none" />
                </svg>
              </div>
            )}
          </button>

          {/* Comment body */}
          <div className="flex-1 min-w-0">
            {comment.is_deleted ? (
              <p style={{ color: '#4A6A8A', fontSize: '12px', fontStyle: 'italic' }}>
                [deleted]
              </p>
            ) : (
              <>
                {/* Author row */}
                <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mb-1">
                  <span style={{ color: '#E8EDF2', fontSize: '12px', fontWeight: 700 }}>
                    {displayName}
                  </span>
                  {author?.is_verified && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="#2A97DF">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2.5" fill="none" />
                    </svg>
                  )}
                  <span style={{ color: '#4A6A8A', fontSize: '11px' }}>@{username}</span>
                  <span style={{ color: '#4A6A8A', fontSize: '11px' }}>·</span>
                  <span style={{ color: '#4A6A8A', fontSize: '11px' }}>{timeAgo(comment.created_at)}</span>
                  {comment.updated_at !== comment.created_at && (
                    <span style={{ color: '#4A6A8A', fontSize: '10px', fontStyle: 'italic' }}>(edited)</span>
                  )}
                </div>

                {/* Content or edit form */}
                {isEditing ? (
                  <div className="mb-1.5">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full resize-none outline-none"
                      style={{
                        background: '#1E2C3A',
                        border: '0.7px solid rgba(42,151,223,0.5)',
                        borderRadius: '2px',
                        padding: '8px 10px',
                        color: '#E8EDF2',
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }}
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={handleEditSave}
                        disabled={savingEdit || !editText.trim()}
                        className="px-3 py-1 text-xs font-semibold transition-all"
                        style={{
                          background: '#2A97DF',
                          color: '#fff',
                          borderRadius: '2px',
                          opacity: savingEdit ? 0.6 : 1,
                        }}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setEditText(comment.content); }}
                        className="px-3 py-1 text-xs font-semibold transition-all"
                        style={{
                          background: 'rgba(42,58,74,0.6)',
                          color: '#7C8FA3',
                          borderRadius: '2px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{
                      color: '#D7DDE5',
                      fontSize: '13px',
                      lineHeight: '1.55',
                      marginBottom: '6px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {comment.content}
                  </p>
                )}

                {/* Action row */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {/* Like */}
                    <button
                      onClick={() => onLike(comment.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80"
                      style={{ color: comment.isLiked ? '#2A97DF' : '#7C8FA3' }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill={comment.isLiked ? '#2A97DF' : 'none'}
                        stroke={comment.isLiked ? '#2A97DF' : 'currentColor'}
                        strokeWidth="2"
                      >
                        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                        <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                      </svg>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>
                        {comment.likes_count > 0 ? formatCount(comment.likes_count) : 'Like'}
                      </span>
                    </button>

                    {/* Reply */}
                    {currentUserId && (
                      <button
                        onClick={() => setIsReplying(!isReplying)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ color: isReplying ? '#2A97DF' : '#7C8FA3' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 00-4-4H4" />
                        </svg>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Reply</span>
                      </button>
                    )}

                    {/* Edit (owner only) */}
                    {isOwner && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ color: '#7C8FA3' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Edit</span>
                      </button>
                    )}

                    {/* Delete (owner only) */}
                    {isOwner && (
                      <button
                        onClick={() => onDelete(comment.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ color: '#7C8FA3' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Delete</span>
                      </button>
                    )}

                    {/* Collapse replies */}
                    {hasReplies && (
                      <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-all hover:opacity-80 ml-auto"
                        style={{ color: '#4A6A8A' }}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                        <span style={{ fontSize: '10px', fontWeight: 600 }}>
                          {isCollapsed
                            ? `${comment.replies!.length} ${comment.replies!.length === 1 ? 'reply' : 'replies'}`
                            : 'Collapse'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Reply composer */}
        {isReplying && currentUserId && (
          <div style={{ paddingLeft: '36px', paddingBottom: '8px' }}>
            <CommentComposer
              currentUserId={currentUserId}
              currentUserProfile={currentUserProfile}
              onSubmit={async (content) => {
                await onReply(comment.id, content);
                setIsReplying(false);
              }}
              placeholder={`Reply to @${username}…`}
              replyingTo={username}
              onCancelReply={() => setIsReplying(false)}
              autoFocus
            />
          </div>
        )}

        {/* Nested replies */}
        {!isCollapsed && hasReplies && (
          <div>
            {comment.replies!.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                currentUserProfile={currentUserProfile}
                onReply={onReply}
                onLike={onLike}
                onEdit={onEdit}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
