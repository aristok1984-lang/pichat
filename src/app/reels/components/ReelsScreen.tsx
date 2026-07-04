'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import { triggerHaptic } from '@/components/GestureSupport';
import ReelUploadModal from '@/app/reels/components/ReelUploadModal';
import CommentsDrawer from '@/components/CommentsDrawer';


interface Reel {
  id: string;
  author_id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  audio_name: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  views_count: number;
  duration_seconds: number;
  created_at: string;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  };
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Single Reel Card ─────────────────────────────────────────────────────────
function ReelCard({
  reel,
  isActive,
  isLiked,
  onLike,
  onFollow,
  currentUserId,
}: {
  reel: Reel;
  isActive: boolean;
  isLiked: boolean;
  onLike: (id: string) => void;
  onFollow: (authorId: string) => void;
  currentUserId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const lastTapRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  }, [isActive]);

  function handleVideoClick() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap = like
      if (!isLiked) {
        onLike(reel.id);
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
      return;
    }
    lastTapRef.current = now;
    // Single tap = pause/play
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress((video.currentTime / video.duration) * 100);
  }

  async function handleShare() {
    const reelUrl = `${window.location.origin}/reels`;
    const shareData = {
      title: `@${reel.user_profiles?.username || 'unknown'} on PiChat`,
      text: reel.caption || 'Check out this reel on PiChat!',
      url: reelUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(reelUrl);
        setShareToast('Link copied!');
        setTimeout(() => setShareToast(''), 2000);
      } catch {
        setShareToast('Could not copy link');
        setTimeout(() => setShareToast(''), 2000);
      }
    }
  }

  const author = reel.user_profiles;

  return (
    <div className="relative w-full h-full flex-shrink-0 overflow-hidden" style={{ background: '#000' }}>
      {/* Video */}
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url}
        loop
        muted={isMuted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onClick={handleVideoClick}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.3) 100%)'
      }} />

      {/* Double-tap heart */}
      {showHeart && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="#EF4444" className="heart-burst">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </div>
      )}

      {/* Pause indicator */}
      {!isPlaying && isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ background: 'rgba(255,255,255,0.2)' }}>
        <div className="h-full transition-all duration-100" style={{ width: `${progress}%`, background: 'var(--primary)' }} />
      </div>

      {/* Top controls */}
      <div className="absolute top-12 left-0 right-0 flex items-center justify-between px-4 z-20">
        <h2 className="text-white font-bold text-base">Reels</h2>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          {isMuted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
            </svg>
          )}
        </button>
      </div>

      {/* Right action buttons */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-20">
        {/* Like */}
        <button onClick={() => onLike(reel.id)} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={isLiked ? '#EF4444' : 'none'} stroke={isLiked ? '#EF4444' : 'white'} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <span className="text-white font-semibold" style={{ fontSize: '10.5px' }}>{formatCount(reel.likes_count + (isLiked ? 1 : 0))}</span>
        </button>

        {/* Comment */}
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <span className="text-white font-semibold" style={{ fontSize: '10.5px' }}>{formatCount(reel.comments_count)}</span>
        </button>

        {/* Share */}
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <span className="text-white font-semibold" style={{ fontSize: '10.5px' }}>Share</span>
        </button>

        {/* More */}
        <button onClick={() => setShowMore(true)} className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '50%' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </div>
        </button>

        {/* Author avatar */}
        <div className="relative">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white"
            style={{ background: getAvatarColor(reel.author_id) }}>
            {author?.avatar_url ? (
              <AppImage src={author.avatar_url} alt={author.display_name || 'Author'} width={44} height={44} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold">
                {author?.display_name?.charAt(0) || '?'}
              </div>
            )}
          </div>
          <button
            onClick={() => onFollow(reel.author_id)}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-16 left-0 right-16 px-4 z-20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white font-bold" style={{ fontSize: '15px' }}>@{author?.username || 'unknown'}</span>
          {author?.is_verified && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--primary)">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <p className="text-white leading-relaxed mb-2 line-clamp-2" style={{ fontSize: '15px' }}>{reel.caption}</p>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <span className="text-white opacity-80 truncate" style={{ fontSize: '10.5px' }}>{reel.audio_name || 'Original Audio'}</span>
        </div>
      </div>

      {/* Share toast */}
      {shareToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-white text-sm font-semibold pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          {shareToast}
        </div>
      )}

      {/* More bottom sheet */}
      {showMore && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" onClick={() => setShowMore(false)}>
          <div
            className="rounded-t-2xl overflow-hidden"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-4 pb-2">
              <p className="text-center font-semibold text-sm py-2" style={{ color: 'var(--foreground)' }}>
                @{author?.username || 'unknown'}
              </p>
            </div>
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                ),
                label: 'Share Reel',
                action: () => { setShowMore(false); handleShare(); },
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                ),
                label: 'Copy Link',
                action: async () => {
                  setShowMore(false);
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/reels`);
                    setShareToast('Link copied!');
                    setTimeout(() => setShareToast(''), 2000);
                  } catch {
                    setShareToast('Could not copy link');
                    setTimeout(() => setShareToast(''), 2000);
                  }
                },
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                ),
                label: 'Not Interested',
                action: () => setShowMore(false),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ),
                label: 'Report',
                labelColor: '#EF4444',
                action: () => setShowMore(false),
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="w-full flex items-center gap-4 px-5 py-3.5 transition-colors active:opacity-70"
                style={{ borderTop: i === 0 ? `1px solid var(--border)` : undefined }}
              >
                <span style={{ color: (item as any).labelColor || 'var(--foreground)' }}>{item.icon}</span>
                <span className="text-sm font-medium" style={{ color: (item as any).labelColor || 'var(--foreground)' }}>
                  {item.label}
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowMore(false)}
              className="w-full py-4 text-sm font-semibold"
              style={{ borderTop: `1px solid var(--border)`, color: 'var(--muted-foreground)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Comments Drawer */}
      {showComments && (
        <CommentsDrawer
          postId={reel.id}
          postType="reel"
          onClose={() => setShowComments(false)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

// ─── Main Reels Screen ────────────────────────────────────────────────────────
export default function ReelsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchBlockedIds().then(() => fetchReels());
      fetchUserLikes();
    } else {
      fetchReels();
    }
  }, [user]);

  async function fetchBlockedIds() {
    if (!user) return;
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    if (data) {
      const ids = new Set<string>();
      data.forEach((row: any) => {
        if (row.blocker_id === user.id) ids.add(row.blocked_id);
        else ids.add(row.blocker_id);
      });
      setBlockedIds(ids);
      return ids;
    }
    return new Set<string>();
  }

  async function fetchReels() {
    const { data } = await supabase
      .from('reels')
      .select('*, user_profiles(username, display_name, avatar_url, is_verified)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      // Filter out reels from blocked/blocking users
      const filtered = blockedIds.size > 0
        ? (data as Reel[]).filter(r => !blockedIds.has(r.author_id))
        : (data as Reel[]);
      setReels(filtered);
    }
    setLoading(false);
  }

  async function fetchUserLikes() {
    if (!user) return;
    const { data } = await supabase.from('reel_likes').select('reel_id').eq('user_id', user.id);
    if (data) setLikedReels(new Set(data.map((r: any) => r.reel_id)));
  }

  async function handleLike(reelId: string) {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isLiked = likedReels.has(reelId);
    setLikedReels(prev => {
      const next = new Set(prev);
      isLiked ? next.delete(reelId) : next.add(reelId);
      return next;
    });
    if (isLiked) {
      await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', user.id);
    } else {
      await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: user.id });
    }
  }

  async function handleFollow(authorId: string) {
    if (!user || authorId === user.id) return;
    const isFollowing = followedUsers.has(authorId);
    setFollowedUsers(prev => {
      const next = new Set(prev);
      isFollowing ? next.delete(authorId) : next.add(authorId);
      return next;
    });
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', authorId);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: authorId });
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && currentIndex < reels.length - 1) {
      triggerHaptic('light');
      setCurrentIndex(prev => prev + 1);
    } else if (diff < 0 && currentIndex > 0) {
      triggerHaptic('light');
      setCurrentIndex(prev => prev - 1);
    }
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.deltaY > 40 && currentIndex < reels.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (e.deltaY < -40 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div
          ref={containerRef}
          className="relative w-full h-full overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          style={{ background: '#000' }}
        >
          {loading ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 relative" style={{ background: '#111' }}>
                <div className="skeleton-pulse w-full h-full" style={{ borderRadius: 0 }} />
                <div className="absolute bottom-24 left-4 space-y-2">
                  <div className="skeleton-pulse h-4 w-32 rounded-lg" />
                  <div className="skeleton-pulse h-3 w-48 rounded-lg" />
                </div>
                <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="skeleton-pulse w-11 h-11 rounded-full" />
                      <div className="skeleton-pulse h-3 w-8 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : reels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground opacity-40">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <p className="text-white font-semibold text-lg">No Reels Yet</p>
              <p className="text-muted-foreground text-sm text-center">Be the first to share a reel with the community</p>
              {user && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-2 px-5 py-2.5 rounded-full font-bold text-sm text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  + Upload Reel
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Reel slides */}
              <div
                className="flex flex-col transition-transform duration-300 ease-out"
                style={{ transform: `translateY(-${currentIndex * 100}%)`, height: `${reels.length * 100}%` }}
              >
                {reels.map((reel, idx) => (
                  <div key={reel.id} style={{ height: `${100 / reels.length}%`, minHeight: '100%' }}>
                    <ReelCard
                      reel={reel}
                      isActive={idx === currentIndex}
                      isLiked={likedReels.has(reel.id)}
                      onLike={handleLike}
                      onFollow={handleFollow}
                      currentUserId={user?.id}
                    />
                  </div>
                ))}
              </div>

              {/* Scroll indicators */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-30">
                {reels.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className="transition-all duration-200"
                    style={{
                      width: '3px',
                      height: idx === currentIndex ? '20px' : '6px',
                      borderRadius: '2px',
                      background: idx === currentIndex ? 'var(--primary)' : 'rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Upload button — always visible when logged in */}
          {user && reels.length > 0 && (
            <button
              onClick={() => setShowUpload(true)}
              className="absolute top-12 right-14 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              title="Upload a reel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          {/* Bottom nav overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-30">
            <BottomNav activeTab="reels" />
          </div>
        </div>
      </MobileFrame>

      {/* Upload modal */}
      {showUpload && (
        <ReelUploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            fetchReels();
          }}
        />
      )}
    </div>
  );
}
