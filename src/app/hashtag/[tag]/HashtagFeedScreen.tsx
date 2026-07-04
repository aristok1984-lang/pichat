'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import CommentsDrawer from '@/components/CommentsDrawer';
import { PostCardSkeleton } from '@/components/Skeleton';
import StatusBarTime from '@/components/StatusBarTime';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  tags: string[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  created_at: string;
  author_id: string;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  };
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(username: string) {
  return AVATAR_COLORS[(username?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
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

export default function HashtagFeedScreen({ tag }: { tag: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [postCount, setPostCount] = useState(0);
  const supabase = createClient();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await supabase
        .from('posts')
        .select('*, user_profiles(username, display_name, avatar_url, is_verified)', { count: 'exact' })
        .contains('tags', [tag])
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
        .limit(40);

      if (data) setPosts(data as Post[]);
      if (count !== null) setPostCount(count);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setLikedPosts(new Set(data.map((l: any) => l.post_id)));
      });
  }, [user]);

  async function handleLike(postId: string) {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isLiked = likedPosts.has(postId);
    setLikedPosts(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 } : p
    ));
    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      }
    } catch (err) {
      // silent
    }
  }

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
          <div className="flex items-center gap-1.5">
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" className="text-foreground">
              <rect x="0" y="4" width="3" height="7" rx="0.5" opacity="0.4" />
              <rect x="4" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.6" />
              <rect x="8" y="1" width="3" height="10" rx="0.5" opacity="0.8" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3 pb-4 border-b border-border" style={{ background: 'var(--secondary)' }}>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-foreground truncate">#{tag}</h1>
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Loading…' : `${formatCount(postCount)} post${postCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Tag pill */}
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
              style={{ background: 'rgba(var(--primary-rgb, 42,171,238), 0.12)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                <line x1="4" y1="9" x2="20" y2="9" />
                <line x1="4" y1="15" x2="20" y2="15" />
                <line x1="10" y1="3" x2="8" y2="21" />
                <line x1="16" y1="3" x2="14" y2="21" />
              </svg>
              <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>#{tag}</span>
            </div>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-3 pb-24">
                {Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'var(--muted)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                    <line x1="4" y1="9" x2="20" y2="9" />
                    <line x1="4" y1="15" x2="20" y2="15" />
                    <line x1="10" y1="3" x2="8" y2="21" />
                    <line x1="16" y1="3" x2="14" y2="21" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No posts yet</p>
                <p className="text-xs text-muted-foreground">Be the first to post with #{tag}</p>
              </div>
            ) : (
              <div className="p-3 space-y-3 pb-24">
                {posts.map((post) => (
                  <HashtagPostCard
                    key={post.id}
                    post={post}
                    isLiked={likedPosts.has(post.id)}
                    onLike={() => handleLike(post.id)}
                    activeTag={tag}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </div>

          <BottomNav activeTab="feed" />
        </div>
      </MobileFrame>
    </div>
  );
}

interface HashtagPostCardProps {
  post: Post;
  isLiked: boolean;
  onLike: () => void;
  activeTag: string;
  currentUserId?: string;
}

function HashtagPostCard({ post, isLiked, onLike, activeTag, currentUserId }: HashtagPostCardProps) {
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const author = post.user_profiles;
  const username = author?.username || 'unknown';
  const displayName = author?.display_name || username;
  const avatarColor = getAvatarColor(username);

  return (
    <div className="post-card animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-3">
        <button
          className="flex items-center gap-3"
          onClick={() => router.push(`/profile/${username}`)}
        >
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-white"
              style={{ background: avatarColor }}
            >
              {author?.avatar_url ? (
                <AppImage src={author.avatar_url} alt={`${displayName} avatar`} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="online-dot absolute bottom-0 right-0" style={{ width: '8px', height: '8px' }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-foreground">{displayName}</span>
              {author?.is_verified && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">@{username}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
            </div>
          </div>
        </button>
        <button
          onClick={() => router.push(`/post/${post.id}`)}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm leading-relaxed text-foreground">{post.content}</p>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.tags.map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/hashtag/${t}`)}
                className="text-xs font-semibold hover:underline transition-all"
                style={{ color: t === activeTag ? 'var(--primary)' : 'var(--muted-foreground)' }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {post.image_url && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ background: 'var(--muted)' }}>
          <AppImage src={post.image_url} alt={`Post by ${displayName}`} width={358} height={220} className="w-full object-cover" />
        </div>
      )}

      {/* Counts */}
      <div className="flex items-center gap-4 px-4 pb-2">
        <span className="text-xs text-muted-foreground font-tabular">{formatCount(post.likes_count)} likes</span>
        <button onClick={() => setShowComments(true)} className="text-xs text-muted-foreground font-tabular hover:underline">
          {formatCount(post.comments_count)} comments
        </button>
      </div>

      <div className="mx-4 h-px" style={{ background: 'var(--border)' }} />

      {/* Reaction bar */}
      <div className="flex items-center justify-around px-2 py-1">
        <button
          onClick={onLike}
          className={`reaction-btn ${isLiked ? 'active' : ''}`}
          style={{ color: isLiked ? 'var(--danger)' : undefined }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill={isLiked ? 'var(--danger)' : 'none'}
            stroke={isLiked ? 'var(--danger)' : 'currentColor'}
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span style={{ color: isLiked ? 'var(--danger)' : undefined }}>{formatCount(post.likes_count)}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="reaction-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span>{formatCount(post.comments_count)}</span>
        </button>

        <button
          onClick={() => router.push(`/post/${post.id}`)}
          className="reaction-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          <span>{formatCount(post.reposts_count)}</span>
        </button>

        <button className="reaction-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>{formatCount(post.shares_count)}</span>
        </button>
      </div>

      {showComments && (
        <CommentsDrawer
          postId={post.id}
          postType="post"
          onClose={() => setShowComments(false)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
