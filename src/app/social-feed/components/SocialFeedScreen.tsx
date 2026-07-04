'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CommentsDrawer from '@/components/CommentsDrawer';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import { PostCardSkeleton } from '@/components/Skeleton';
import { EmptyFeed, ErrorState } from '@/components/EmptyState';
import StatusBarTime from '@/components/StatusBarTime';
import ComposeModal from './ComposeModal';

interface Post {
  id: string;
  content: string;
  title?: string;
  image_url: string;
  video_url?: string;
  link_url?: string;
  poll_options?: { text: string; votes: number }[] | null;
  post_type?: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  created_at: string;
  author_id: string;
  community_id: string | null;
  is_spoiler?: boolean;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  };
  communities?: {
    name: string;
    slug: string;
  } | null;
}

const AVATAR_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function getAvatarColor(username: string) {
  const idx = (username?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
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

type FeedTab = 'hot' | 'new' | 'top' | 'media';
type MainTab = 'following' | 'communities' | 'trending' | 'discover';

export default function SocialFeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('trending');
  const [feedTab, setFeedTab] = useState<FeedTab>('hot');
  const [composeOpen, setComposeOpen] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    async function fetchBlocked() {
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${user!.id},blocked_id.eq.${user!.id}`);
      if (data) {
        const ids = new Set<string>();
        data.forEach((row: any) => {
          if (row.blocker_id === user!.id) ids.add(row.blocked_id);
          else ids.add(row.blocker_id);
        });
        setBlockedIds(ids);
      }
    }
    fetchBlocked();
  }, [user]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let query = supabase
        .from('posts')
        .select('*, user_profiles(username, display_name, avatar_url, is_verified), communities(name, slug)')
        .is('parent_post_id', null)
        .limit(30);

      if (feedTab === 'hot' || mainTab === 'trending') {
        query = query.order('likes_count', { ascending: false });
      } else if (feedTab === 'new') {
        query = query.order('created_at', { ascending: false });
      } else if (feedTab === 'top') {
        query = query.order('comments_count', { ascending: false });
      } else if (feedTab === 'media') {
        query = query.not('image_url', 'is', null).neq('image_url', '').order('created_at', { ascending: false });
      }

      if (mainTab === 'communities') {
        query = query.not('community_id', 'is', null);
      } else if (mainTab === 'following' && user) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const followingIds = follows?.map((f: any) => f.following_id) || [];
        if (followingIds.length > 0) {
          query = query.in('author_id', followingIds);
        }
      }

      const { data } = await query;
      if (data) {
        const filtered = blockedIds.size > 0
          ? (data as Post[]).filter(p => !blockedIds.has(p.author_id))
          : (data as Post[]);
        setPosts(filtered);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [feedTab, mainTab, user, blockedIds]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Refresh feed when user navigates back to this page (e.g. after creating a post)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        fetchPosts();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchPosts]);

  useEffect(() => {
    if (!user) return;
    async function fetchUserInteractions() {
      const results = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user!.id),
        supabase.from('post_bookmarks').select('post_id').eq('user_id', user!.id),
      ]);
      if (results[0].data) setLikedPosts(new Set(results[0].data.map((l: any) => l.post_id)));
      if (results[1].data) setBookmarkedPosts(new Set(results[1].data.map((b: any) => b.post_id)));
    }
    fetchUserInteractions();
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('feed_posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        if (payload.new.parent_post_id) return;
        const { data } = await supabase
          .from('posts')
          .select('*, user_profiles(username, display_name, avatar_url, is_verified), communities(name, slug)')
          .eq('id', payload.new.id)
          .single();
        if (data) setPosts(prev => [data as Post, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleLike(postId: string) {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isLiked = likedPosts.has(postId);
    setLikedPosts(prev => { const next = new Set(prev); isLiked ? next.delete(postId) : next.add(postId); return next; });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 } : p));
    try {
      if (isLiked) await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      else await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    } catch {}
  }

  async function handleBookmark(postId: string) {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isBookmarked = bookmarkedPosts.has(postId);
    setBookmarkedPosts(prev => { const next = new Set(prev); isBookmarked ? next.delete(postId) : next.add(postId); return next; });
    try {
      if (isBookmarked) await supabase.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      else await supabase.from('post_bookmarks').insert({ post_id: postId, user_id: user.id });
    } catch {}
  }

  const MAIN_TABS: { key: MainTab; label: string }[] = [
    { key: 'following', label: 'Following' },
    { key: 'communities', label: 'Communities' },
    { key: 'trending', label: 'Trending' },
    { key: 'discover', label: 'Discover' },
  ];

  const FEED_TABS: { key: FeedTab; label: string }[] = [
    { key: 'hot', label: '🔥 Hot' },
    { key: 'new', label: '✨ New' },
    { key: 'top', label: '⬆️ Top' },
    { key: 'media', label: '🖼️ Media' },
  ];

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

        <div className="flex flex-col h-full overflow-hidden relative">
          {/* Header */}
          <div className="px-4 pt-3 pb-0" style={{ background: '#17212B', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}>
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-bold" style={{ color: '#E8EDF2', fontSize: '16px' }}>Feed</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/search')}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{ color: '#7C8FA3' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{ color: '#7C8FA3' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main tabs */}
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {MAIN_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMainTab(key)}
                  className="px-3 py-2.5 text-xs font-semibold shrink-0 transition-all relative"
                  style={{
                    color: mainTab === key ? '#2A97DF' : '#7C8FA3',
                    borderBottom: mainTab === key ? '2px solid #2A97DF' : '2px solid transparent',
                    fontSize: '13px',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed sort tabs */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-hide" style={{ background: '#0E1621', borderBottom: '0.7px solid rgba(42,58,74,0.5)' }}>
            {FEED_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFeedTab(key)}
                className="px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all"
                style={{
                  background: feedTab === key ? 'rgba(42,151,223,0.15)' : 'transparent',
                  color: feedTab === key ? '#2A97DF' : '#7C8FA3',
                  border: feedTab === key ? '0.7px solid rgba(42,151,223,0.4)' : '0.7px solid transparent',
                  fontSize: '12px',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Post feed */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#0E1621' }}>
            {loading ? (
              <div className="p-3 space-y-2 pb-24">
                {Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)}
              </div>
            ) : error ? (
              <ErrorState onRetry={fetchPosts} />
            ) : posts.length === 0 ? (
              <EmptyFeed onCompose={() => setComposeOpen(true)} />
            ) : (
              <div className="p-2 space-y-2 pb-24">
                {posts.map((post) => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    isLiked={likedPosts.has(post.id)}
                    isBookmarked={bookmarkedPosts.has(post.id)}
                    onLike={() => handleLike(post.id)}
                    onBookmark={() => handleBookmark(post.id)}
                    getAvatarColor={getAvatarColor}
                    formatCount={formatCount}
                    timeAgo={timeAgo}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Floating compose */}
          <button
            onClick={() => router.push('/create-post')}
            className="floating-btn"
            title="Create post"
            style={{ background: 'linear-gradient(135deg, #2A97DF, #52C5FC)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          {composeOpen && (
            <ComposeModal
              onClose={() => setComposeOpen(false)}
              onPosted={() => { setComposeOpen(false); fetchPosts(); }}
              userId={user?.id}
            />
          )}

          {/* Sticky brain+circuit icon */}
          <div
            style={{
              position: 'fixed',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              width: '72px',
              height: '72px',
              animation: 'syncPulse 3s ease-in-out infinite',
            }}
          >
            <svg width="72" height="72" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="blueGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="7" result="blur"/>
                  <feFlood floodColor="#2FA8FF" floodOpacity="0.95" result="glowColor"/>
                  <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="whiteSoft" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#ffffff" floodOpacity="0.16"/>
                  <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000000" floodOpacity="0.36"/>
                </filter>
              </defs>
              <path d="M496 250 C455 215 405 225 383 266 C345 260 315 280 306 318 C265 327 238 359 239 401 C205 421 190 455 203 493 C178 519 174 558 198 586 C174 626 187 669 225 689 C221 730 251 760 291 760 C305 800 348 817 385 799 C418 835 475 823 497 778 Z M528 250 C569 215 619 225 641 266 C679 260 709 280 718 318 C759 327 786 359 785 401 C819 421 834 455 821 493 C846 519 850 558 826 586 C850 626 837 669 799 689 C803 730 773 760 733 760 C719 800 676 817 639 799 C606 835 549 823 527 778 Z" fill="#050E1F"/>
              <g fill="none" stroke="#F4F7FF" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" filter="url(#whiteSoft)">
                <path d="M496 250 C455 215 405 225 383 266 C345 260 315 280 306 318 C265 327 238 359 239 401 C205 421 190 455 203 493 C178 519 174 558 198 586 C174 626 187 669 225 689 C221 730 251 760 291 760 C305 800 348 817 385 799 C418 835 475 823 497 778 Z"/>
                <path d="M528 250 C569 215 619 225 641 266 C679 260 709 280 718 318 C759 327 786 359 785 401 C819 421 834 455 821 493 C846 519 850 558 826 586 C850 626 837 669 799 689 C803 730 773 760 733 760 C719 800 676 817 639 799 C606 835 549 823 527 778 Z"/>
                <path d="M496 250 L496 395 C435 420 405 470 405 512 C405 554 435 604 496 629 L496 778"/>
                <path d="M528 250 L528 395 C589 420 619 470 619 512 C619 554 589 604 528 629 L528 778"/>
              </g>
              <g fill="none" stroke="#F4F7FF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" filter="url(#whiteSoft)">
                <path d="M350 300 L405 360 L455 300"/><path d="M405 360 L405 430 L455 430"/>
                <path d="M350 410 L405 430 L350 500 L405 570"/><path d="M405 570 L455 520 L455 640 L405 700"/>
                <path d="M350 635 L405 700 L455 700"/><path d="M285 450 L350 410 L350 500 L285 555"/>
                <path d="M285 650 L350 635 L350 720"/><path d="M455 640 L485 640"/><path d="M455 430 L485 430"/>
              </g>
              <g fill="#F4F7FF" filter="url(#whiteSoft)">
                <circle cx="350" cy="300" r="16"/><circle cx="405" cy="360" r="14"/><circle cx="455" cy="300" r="17"/>
                <circle cx="350" cy="410" r="16"/><circle cx="405" cy="430" r="17"/><circle cx="455" cy="430" r="15"/>
                <circle cx="350" cy="500" r="14"/><circle cx="285" cy="450" r="15"/><circle cx="285" cy="555" r="15"/>
                <circle cx="405" cy="570" r="16"/><circle cx="455" cy="520" r="14"/><circle cx="350" cy="635" r="17"/>
                <circle cx="405" cy="700" r="16"/><circle cx="455" cy="700" r="15"/><circle cx="285" cy="650" r="15"/>
                <circle cx="350" cy="720" r="15"/><circle cx="455" cy="640" r="16"/>
              </g>
              <circle cx="512" cy="512" r="86" fill="#09284D" opacity="0.45"/>
              <g fill="none" stroke="#49B9FF" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" filter="url(#blueGlow)">
                <circle cx="512" cy="512" r="96"/>
                <path d="M265 512 H430"/><path d="M594 512 H760"/>
                <path d="M445 512 L474 512 L486 472 L506 565 L529 445 L553 557 L570 512 L596 512"/>
              </g>
            </svg>
          </div>

          <BottomNav activeTab="feed" />
        </div>
      </MobileFrame>

      <style>{`
        @keyframes syncPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(42,171,238,0.0); }
          50% { box-shadow: 0 0 0 5px rgba(42,171,238,0.12); }
        }
      `}</style>
    </div>
  );
}

interface FeedPostCardProps {
  post: Post;
  isLiked: boolean;
  isBookmarked: boolean;
  onLike: () => void;
  onBookmark: () => void;
  getAvatarColor: (u: string) => string;
  formatCount: (n: number) => string;
  timeAgo: (d: string) => string;
  currentUserId?: string;
}

function FeedPostCard({ post, isLiked, isBookmarked, onLike, onBookmark, getAvatarColor, formatCount, timeAgo, currentUserId }: FeedPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [pollVoted, setPollVoted] = useState<number | null>(null);
  const [pollOptions, setPollOptions] = useState<{ text: string; votes: number }[]>(post.poll_options || []);
  const router = useRouter();
  const author = post.user_profiles;
  const username = author?.username || 'unknown';
  const displayName = author?.display_name || username;
  const avatarColor = getAvatarColor(username);

  function handlePollVote(idx: number) {
    if (pollVoted !== null) return;
    setPollVoted(idx);
    setPollOptions(prev => prev.map((o, i) => i === idx ? { ...o, votes: o.votes + 1 } : o));
  }

  const totalPollVotes = pollOptions.reduce((sum, o) => sum + o.votes, 0);

  return (
    <div
      className="animate-fade-in overflow-hidden"
      style={{
        background: '#17212B',
        border: '0.7px solid rgba(42,58,74,0.8)',
        borderRadius: '2px',
      }}
    >
      {/* Community badge */}
      {post.communities && (
        <button
          onClick={() => router.push(`/communities/${post.communities!.slug}`)}
          className="px-3 pt-2.5 pb-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span style={{ color: '#2A97DF', fontSize: '11px', fontWeight: 600 }}>
            c/{post.communities.name}
          </span>
        </button>
      )}

      {/* Post header */}
      <div className="flex items-start justify-between px-3 pt-2.5 pb-2">
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => router.push(`/profile/${username}`)}
        >
          <div
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: avatarColor }}
          >
            {author?.avatar_url ? (
              <AppImage src={author.avatar_url} alt={`${displayName} avatar`} width={32} height={32} className="w-full h-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span style={{ color: '#E8EDF2', fontSize: '13px', fontWeight: 600 }}>{displayName}</span>
              {author?.is_verified && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#2A97DF">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
            <span style={{ color: '#7C8FA3', fontSize: '10.5px' }}>@{username} · {timeAgo(post.created_at)}</span>
          </div>
        </button>
        <button style={{ color: '#7C8FA3' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* Post title */}
      {post.title && (
        <div className="px-3 pb-1">
          <button
            onClick={() => router.push(`/post/${post.id}`)}
            className="text-left w-full"
          >
            <p style={{ color: '#E8EDF2', fontSize: '15px', fontWeight: 500, lineHeight: 1.4 }}>
              {post.is_spoiler ? (
                <span style={{ background: '#E8EDF2', color: '#E8EDF2', borderRadius: '2px' }}>
                  {post.title}
                </span>
              ) : post.title}
            </p>
          </button>
        </div>
      )}

      {/* Post content */}
      {post.content && (
        <div className="px-3 pb-2">
          <p style={{ color: '#D7DDE5', fontSize: '15px', fontWeight: 400, lineHeight: 1.5 }}>
            {post.content.length > 200 ? post.content.slice(0, 200) + '…' : post.content}
          </p>
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {post.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => router.push(`/hashtag/${tag}`)}
                  style={{ color: '#2A97DF', fontSize: '13px', fontWeight: 600 }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Link preview */}
      {post.post_type === 'link' && post.link_url && (
        <div
          className="mx-3 mb-2 px-3 py-2.5 flex items-center gap-2"
          style={{ background: 'rgba(42,151,223,0.08)', border: '0.7px solid rgba(42,151,223,0.25)', borderRadius: '2px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2A97DF', fontSize: '13px', fontWeight: 500 }}
            className="truncate hover:underline"
          >
            {post.link_url}
          </a>
        </div>
      )}

      {/* Poll */}
      {post.post_type === 'poll' && pollOptions.length > 0 && (
        <div className="mx-3 mb-2 space-y-1.5">
          {pollOptions.map((option, idx) => {
            const pct = totalPollVotes > 0 ? Math.round((option.votes / totalPollVotes) * 100) : 0;
            const isWinner = pollVoted !== null && option.votes === Math.max(...pollOptions.map(o => o.votes));
            return (
              <button
                key={idx}
                onClick={() => handlePollVote(idx)}
                disabled={pollVoted !== null}
                className="w-full relative overflow-hidden text-left"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `0.7px solid ${pollVoted === idx ? '#2A97DF' : 'rgba(42,58,74,0.7)'}`,
                  borderRadius: '2px',
                  padding: '8px 12px',
                }}
              >
                {pollVoted !== null && (
                  <div
                    className="absolute inset-y-0 left-0 transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isWinner ? 'rgba(42,151,223,0.2)' : 'rgba(255,255,255,0.05)',
                    }}
                  />
                )}
                <div className="relative flex items-center justify-between">
                  <span style={{ color: '#E8EDF2', fontSize: '14px' }}>{option.text}</span>
                  {pollVoted !== null && (
                    <span style={{ color: '#7C8FA3', fontSize: '12px', fontWeight: 600 }}>{pct}%</span>
                  )}
                </div>
              </button>
            );
          })}
          {pollVoted !== null && (
            <p style={{ color: '#7C8FA3', fontSize: '11px' }}>{totalPollVotes} votes</p>
          )}
        </div>
      )}

      {/* Post image */}
      {post.image_url && (
        <div className="mx-3 mb-2 overflow-hidden" style={{ borderRadius: '2px', background: '#242F3C' }}>
          <AppImage
            src={post.image_url}
            alt={`Post by ${displayName}`}
            width={358}
            height={220}
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Engagement counts */}
      <div className="flex items-center gap-3 px-3 pb-1.5">
        <span style={{ color: '#7C8FA3', fontSize: '11px' }}>{formatCount(post.likes_count)} upvotes</span>
        <button onClick={() => setShowComments(true)} style={{ color: '#7C8FA3', fontSize: '11px' }} className="hover:underline">
          {formatCount(post.comments_count)} comments
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3" style={{ height: '0.7px', background: 'rgba(42,58,74,0.8)' }} />

      {/* Action row */}
      <div className="flex items-center px-1 py-1">
        {/* Upvote */}
        <button
          onClick={onLike}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all"
          style={{ color: isLiked ? '#2A97DF' : '#7C8FA3' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={isLiked ? '#2A97DF' : 'none'}
            stroke={isLiked ? '#2A97DF' : 'currentColor'}
            strokeWidth="2"
          >
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
            <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatCount(post.likes_count)}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all"
          style={{ color: '#7C8FA3' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatCount(post.comments_count)}</span>
        </button>

        {/* Share */}
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all"
          style={{ color: '#7C8FA3' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Share</span>
        </button>

        {/* Save */}
        <button
          onClick={onBookmark}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all ml-auto"
          style={{ color: isBookmarked ? '#2A97DF' : '#7C8FA3' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill={isBookmarked ? '#2A97DF' : 'none'}
            stroke={isBookmarked ? '#2A97DF' : 'currentColor'}
            strokeWidth="2"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>
      </div>

      {/* Comments Drawer */}
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
