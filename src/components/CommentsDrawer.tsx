'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import AppImage from '@/components/ui/AppImage';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author?: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

interface CommentsDrawerProps {
  postId: string;
  postType: 'post' | 'reel';
  onClose: () => void;
  currentUserId?: string;
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function CommentsDrawer({ postId, postType, onClose, currentUserId }: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatar_url?: string; display_name?: string } | null>(null);
  const supabase = createClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('avatar_url, display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCurrentUserProfile(data);
      });
  }, [user]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      // Comments are stored as posts with parent_post_id
      const { data } = await supabase
        .from('posts')
        .select('id, content, created_at, author_id, user_profiles:author_id(username, display_name, avatar_url)')
        .eq('parent_post_id', postId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        setComments(data.map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author_id: c.author_id,
          author: c.user_profiles,
        })));
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit() {
    if (!text.trim() || !currentUserId || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await supabase
        .from('posts')
        .insert({
          author_id: currentUserId,
          content: text.trim(),
          parent_post_id: postId,
        })
        .select('id, content, created_at, author_id, user_profiles:author_id(username, display_name, avatar_url)')
        .single();

      if (data) {
        setComments(prev => [...prev, {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          author_id: data.author_id,
          author: (data as any).user_profiles,
        }]);
        // Increment comments_count via RPC (trigger also handles this server-side)
        await supabase.rpc('increment_comments_count', { post_id: postId }).catch(() => {});
      }
      setText('');
    } catch (err) {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full rounded-t-2xl flex flex-col"
        style={{ background: 'var(--secondary)', maxHeight: '70%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Comments ({comments.length})</h3>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                <path d="M21 12a9 9 0 00-9-9" />
              </svg>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5">
                <div
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                  style={{ background: getAvatarColor(comment.author_id) }}
                >
                  {comment.author?.avatar_url ? (
                    <AppImage src={comment.author.avatar_url} alt={comment.author.display_name || 'User'} width={32} height={32} className="w-full h-full object-cover" />
                  ) : (
                    comment.author?.display_name?.charAt(0) || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-foreground">{comment.author?.display_name || comment.author?.username || 'User'}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        {currentUserId ? (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
            <div
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
              style={{ background: currentUserProfile?.avatar_url ? 'transparent' : 'var(--primary)' }}
            >
              {currentUserProfile?.avatar_url ? (
                <AppImage
                  src={currentUserProfile.avatar_url}
                  alt={currentUserProfile.display_name || 'You'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUserProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{
                background: text.trim() ? 'var(--primary)' : 'var(--muted)',
                color: text.trim() ? 'white' : 'var(--muted-foreground)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">Sign in to comment</p>
          </div>
        )}
      </div>
    </div>
  );
}
