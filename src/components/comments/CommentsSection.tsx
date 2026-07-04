'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CommentItem from './CommentItem';
import CommentComposer from './CommentComposer';
import { Comment, SortOrder } from './types';

const PAGE_SIZE = 20;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function CommentSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div style={{ paddingLeft: depth * 16 }} className="py-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full shrink-0 animate-pulse" style={{ background: '#1E2C3A' }} />
        <div className="flex-1 space-y-1.5">
          <div className="flex gap-2">
            <div className="h-2.5 rounded animate-pulse" style={{ background: '#1E2C3A', width: '80px' }} />
            <div className="h-2.5 rounded animate-pulse" style={{ background: '#1E2C3A', width: '50px' }} />
          </div>
          <div className="h-3 rounded animate-pulse" style={{ background: '#1E2C3A', width: '90%' }} />
          <div className="h-3 rounded animate-pulse" style={{ background: '#1E2C3A', width: '70%' }} />
        </div>
      </div>
    </div>
  );
}

// ── Build tree from flat list ─────────────────────────────────────────────────
function buildCommentTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  flat.forEach((c) => {
    map.set(c.id, { ...c, replies: [] });
  });

  map.forEach((comment) => {
    if (comment.parent_id && map.has(comment.parent_id)) {
      map.get(comment.parent_id)!.replies!.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

// ── Sort flat list ────────────────────────────────────────────────────────────
function sortComments(comments: Comment[], sort: SortOrder): Comment[] {
  return [...comments].sort((a, b) => {
    if (sort === 'best') {
      const scoreA = a.likes_count - (a.depth * 0.1);
      const scoreB = b.likes_count - (b.depth * 0.1);
      return scoreB - scoreA;
    }
    if (sort === 'top') return b.likes_count - a.likes_count;
    // new
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

interface CommentsSectionProps {
  postId: string;
  initialCommentsCount?: number;
  onCountChange?: (count: number) => void;
}

export default function CommentsSection({
  postId,
  initialCommentsCount = 0,
  onCountChange,
}: CommentsSectionProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [flatComments, setFlatComments] = useState<Comment[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>('best');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(initialCommentsCount);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    avatar_url?: string | null;
    display_name?: string;
    username?: string;
  } | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load current user profile ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('avatar_url, display_name, username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setCurrentUserProfile(data);
      });
  }, [user]);

  // ── Fetch comments ─────────────────────────────────────────────────────────
  const fetchComments = useCallback(
    async (pageNum = 0, append = false) => {
      if (pageNum === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error: fetchErr, count } = await supabase
          .from('comments')
          .select(
            `id, post_id, author_id, parent_id, content, likes_count, depth, is_deleted, created_at, updated_at,
             user_profiles:author_id (username, display_name, avatar_url, is_verified)`,
            { count: 'exact' }
          )
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
          .range(from, to);

        if (fetchErr) throw fetchErr;

        const rows: Comment[] = (data || []).map((r: any) => ({
          id: r.id,
          post_id: r.post_id,
          author_id: r.author_id,
          parent_id: r.parent_id,
          content: r.content,
          likes_count: r.likes_count,
          depth: r.depth,
          is_deleted: r.is_deleted,
          created_at: r.created_at,
          updated_at: r.updated_at,
          user_profiles: r.user_profiles,
          replies: [],
          isLiked: false,
        }));

        const total = count ?? 0;
        setTotalCount(total);
        onCountChange?.(total);
        setHasMore(from + rows.length < total);

        if (append) {
          setFlatComments((prev) => {
            const existingIds = new Set(prev.map((c) => c.id));
            return [...prev, ...rows.filter((r) => !existingIds.has(r.id))];
          });
        } else {
          setFlatComments(rows);
        }

        // Load liked IDs for current user
        if (user && rows.length > 0) {
          const ids = rows.map((r) => r.id);
          const { data: likes } = await supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', ids);
          if (likes) {
            setLikedIds((prev) => {
              const next = new Set(prev);
              likes.forEach((l: any) => next.add(l.comment_id));
              return next;
            });
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load comments');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [postId, user]
  );

  useEffect(() => {
    setPage(0);
    setFlatComments([]);
    fetchComments(0, false);
  }, [postId]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          // Fetch author profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('username, display_name, avatar_url, is_verified')
            .eq('id', newRow.author_id)
            .single();

          const newComment: Comment = {
            id: newRow.id,
            post_id: newRow.post_id,
            author_id: newRow.author_id,
            parent_id: newRow.parent_id,
            content: newRow.content,
            likes_count: newRow.likes_count ?? 0,
            depth: newRow.depth ?? 0,
            is_deleted: newRow.is_deleted ?? false,
            created_at: newRow.created_at,
            updated_at: newRow.updated_at,
            user_profiles: profile || null,
            replies: [],
            isLiked: false,
          };

          setFlatComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            setTotalCount((t) => {
              const next = t + 1;
              onCountChange?.(next);
              return next;
            });
            return [...prev, newComment];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setFlatComments((prev) =>
            prev.map((c) =>
              c.id === updated.id
                ? { ...c, content: updated.content, likes_count: updated.likes_count, is_deleted: updated.is_deleted, updated_at: updated.updated_at }
                : c
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          const deleted = payload.old as any;
          setFlatComments((prev) => prev.filter((c) => c.id !== deleted.id));
          setTotalCount((t) => {
            const next = Math.max(0, t - 1);
            onCountChange?.(next);
            return next;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleAddComment(content: string) {
    if (!user) return;
    // Optimistic insert
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Comment = {
      id: optimisticId,
      post_id: postId,
      author_id: user.id,
      parent_id: null,
      content,
      likes_count: 0,
      depth: 0,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_profiles: {
        username: currentUserProfile?.username || '',
        display_name: currentUserProfile?.display_name || '',
        avatar_url: currentUserProfile?.avatar_url || null,
        is_verified: false,
      },
      replies: [],
      isLiked: false,
    };
    setFlatComments((prev) => [...prev, optimistic]);
    setTotalCount((t) => { const n = t + 1; onCountChange?.(n); return n; });

    const { data, error: insertErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: user.id, content, parent_id: null })
      .select('id, created_at, updated_at, depth')
      .single();

    if (insertErr) {
      setFlatComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setTotalCount((t) => { const n = Math.max(0, t - 1); onCountChange?.(n); return n; });
    } else if (data) {
      setFlatComments((prev) =>
        prev.map((c) =>
          c.id === optimisticId
            ? { ...c, id: data.id, created_at: data.created_at, updated_at: data.updated_at, depth: data.depth }
            : c
        )
      );
    }
  }

  async function handleReply(parentId: string, content: string) {
    if (!user) return;
    const parent = flatComments.find((c) => c.id === parentId);
    const depth = (parent?.depth ?? 0) + 1;

    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Comment = {
      id: optimisticId,
      post_id: postId,
      author_id: user.id,
      parent_id: parentId,
      content,
      likes_count: 0,
      depth,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_profiles: {
        username: currentUserProfile?.username || '',
        display_name: currentUserProfile?.display_name || '',
        avatar_url: currentUserProfile?.avatar_url || null,
        is_verified: false,
      },
      replies: [],
      isLiked: false,
    };
    setFlatComments((prev) => [...prev, optimistic]);
    setTotalCount((t) => { const n = t + 1; onCountChange?.(n); return n; });

    const { data, error: insertErr } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: user.id, content, parent_id: parentId })
      .select('id, created_at, updated_at, depth')
      .single();

    if (insertErr) {
      setFlatComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setTotalCount((t) => { const n = Math.max(0, t - 1); onCountChange?.(n); return n; });
    } else if (data) {
      setFlatComments((prev) =>
        prev.map((c) =>
          c.id === optimisticId
            ? { ...c, id: data.id, created_at: data.created_at, updated_at: data.updated_at, depth: data.depth }
            : c
        )
      );
    }
  }

  async function handleLike(commentId: string) {
    if (!user) return;
    const isLiked = likedIds.has(commentId);

    // Optimistic
    setLikedIds((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(commentId) : next.add(commentId);
      return next;
    });
    setFlatComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, likes_count: Math.max(0, c.likes_count + (isLiked ? -1 : 1)) }
          : c
      )
    );

    if (isLiked) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: user.id });
    }
  }

  async function handleEdit(commentId: string, content: string) {
    // Optimistic
    setFlatComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, content, updated_at: new Date().toISOString() } : c
      )
    );
    await supabase
      .from('comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId);
  }

  async function handleDelete(commentId: string) {
    // Soft delete: mark as deleted
    setFlatComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, is_deleted: true, content: '[deleted]' } : c))
    );
    await supabase
      .from('comments')
      .update({ is_deleted: true, content: '[deleted]' })
      .eq('id', commentId);
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchComments(nextPage, true);
  }

  // ── Build tree with liked state ────────────────────────────────────────────
  const flatWithLikes = flatComments.map((c) => ({ ...c, isLiked: likedIds.has(c.id) }));
  const sorted = sortComments(flatWithLikes, sort);
  const tree = buildCommentTree(sorted);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#131D27' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C8FA3" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ color: '#E8EDF2', fontSize: '13px', fontWeight: 700 }}>
            {totalCount > 0 ? `${totalCount} Comment${totalCount !== 1 ? 's' : ''}` : 'Comments'}
          </span>
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-0.5">
          {(['best', 'new', 'top'] as SortOrder[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="px-2.5 py-1 text-xs font-semibold capitalize transition-all"
              style={{
                borderRadius: '2px',
                background: sort === s ? 'rgba(42,151,223,0.15)' : 'transparent',
                color: sort === s ? '#2A97DF' : '#7C8FA3',
                border: sort === s ? '0.7px solid rgba(42,151,223,0.3)' : '0.7px solid transparent',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      {user ? (
        <div style={{ borderBottom: '0.7px solid rgba(42,58,74,0.6)', paddingBottom: '12px' }}>
          <CommentComposer
            currentUserId={user.id}
            currentUserProfile={currentUserProfile}
            onSubmit={handleAddComment}
            placeholder="Share your thoughts…"
          />
        </div>
      ) : (
        <div
          className="px-3 py-3 text-center"
          style={{ borderBottom: '0.7px solid rgba(42,58,74,0.6)' }}
        >
          <p style={{ color: '#7C8FA3', fontSize: '12px' }}>
            Sign in to join the conversation
          </p>
        </div>
      )}

      {/* Comment list */}
      <div className="px-3">
        {loading ? (
          <div className="py-2">
            {[0, 1, 2].map((i) => (
              <CommentSkeleton key={i} depth={0} />
            ))}
            <CommentSkeleton depth={1} />
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p style={{ color: '#E8EDF2', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
            <button
              onClick={() => fetchComments(0, false)}
              className="px-4 py-1.5 text-xs font-semibold transition-all"
              style={{ background: '#2A97DF', color: '#fff', borderRadius: '2px' }}
            >
              Retry
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="py-8 text-center">
            <svg
              className="mx-auto mb-3"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2A3A4A"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p style={{ color: '#4A6A8A', fontSize: '13px', fontWeight: 600 }}>No comments yet</p>
            <p style={{ color: '#3A5A6A', fontSize: '11px', marginTop: '4px' }}>
              Be the first to share your thoughts
            </p>
          </div>
        ) : (
          <>
            {tree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                currentUserProfile={currentUserProfile}
                onReply={handleReply}
                onLike={handleLike}
                onEdit={handleEdit}
                onDelete={handleDelete}
                depth={0}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="py-3 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-1.5 text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(42,151,223,0.1)',
                    color: '#2A97DF',
                    borderRadius: '2px',
                    border: '0.7px solid rgba(42,151,223,0.3)',
                    opacity: loadingMore ? 0.6 : 1,
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more comments'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
