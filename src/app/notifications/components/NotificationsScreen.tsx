'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import StatusBarTime from '@/components/StatusBarTime';
import { useNotifications, Notification, FilterType, NotificationType } from '@/lib/hooks/useNotifications';

// ─── Helpers ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
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

// ─── Notification Icon ───────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  const configs: Record<string, { bg: string; color: string; path: string }> = {
    like: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', path: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
    reel_like: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', path: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' },
    follow: { bg: 'rgba(42,171,238,0.15)', color: '#2AABEE', path: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM19 8v6M22 11h-6' },
    comment: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', path: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
    reply: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', path: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
    mention: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', path: 'M12 8a4 4 0 100 8 4 4 0 000-8zM16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94' },
    community_post: { bg: 'rgba(16,185,129,0.15)', color: '#10B981', path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
    community_invite: { bg: 'rgba(16,185,129,0.15)', color: '#10B981', path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
    community_announcement: { bg: 'rgba(16,185,129,0.15)', color: '#10B981', path: 'M22 17H2a3 3 0 000 6h20a3 3 0 000-6zM6 17V7a6 6 0 0112 0v10' },
    group_invite: { bg: 'rgba(16,185,129,0.15)', color: '#10B981', path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
    direct_message: { bg: 'rgba(42,171,238,0.15)', color: '#2AABEE', path: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
    moderator_action: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
    verification_update: { bg: 'rgba(42,171,238,0.15)', color: '#2AABEE', path: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
    ai_assistant: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6', path: 'M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zM12 16a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2v-2a2 2 0 012-2zM4 12a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2H6a2 2 0 01-2-2zM14 12a2 2 0 012-2h2a2 2 0 012 2 2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  };

  const cfg = configs[type] || configs.ai_assistant;

  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
      style={{ background: cfg.bg }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={cfg.path} />
      </svg>
    </div>
  );
}

// ─── Notification Text ───────────────────────────────────────────────────────

function getNotifText(notif: Notification): string {
  if (notif.body) return notif.body;
  if (notif.message) return notif.message;
  const actor = notif.actor?.display_name || 'Someone';
  switch (notif.notification_type) {
    case 'like': return `${actor} liked your post`;
    case 'reel_like': return `${actor} liked your reel`;
    case 'comment': return `${actor} commented on your post`;
    case 'reply': return `${actor} replied to your comment`;
    case 'follow': return `${actor} started following you`;
    case 'mention': return `${actor} mentioned you`;
    case 'community_post': return `${actor} posted in your community`;
    case 'community_invite': return `${actor} invited you to a community`;
    case 'community_announcement': return `New announcement in your community`;
    case 'group_invite': return `${actor} invited you to a group`;
    case 'direct_message': return `${actor} sent you a message`;
    case 'moderator_action': return `A moderator took action on your content`;
    case 'verification_update': return `Your verification status was updated`;
    case 'ai_assistant': return `Your AI assistant has a response`;
    default: return 'You have a new notification';
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="w-11 h-11 shrink-0" style={{ background: 'var(--muted)', borderRadius: '2px' }} />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3" style={{ background: 'var(--muted)', width: '75%', borderRadius: '2px' }} />
        <div className="h-2.5" style={{ background: 'var(--muted)', width: '45%', borderRadius: '2px' }} />
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 flex items-center justify-center mb-4" style={{ background: 'var(--muted)', borderRadius: '2px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </div>
      <p className="font-semibold text-foreground mb-1" style={{ fontSize: '15px' }}>
        {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
      </p>
      <p className="text-muted-foreground" style={{ fontSize: '13px' }}>
        {filter === 'all' ? "When someone interacts with you, it'll show up here."
          : `You have no ${filter} notifications right now.`}
      </p>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 flex items-center justify-center mb-4" style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '2px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="font-semibold text-foreground mb-1" style={{ fontSize: '15px' }}>Something went wrong</p>
      <p className="text-muted-foreground mb-4" style={{ fontSize: '13px' }}>{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-semibold transition-all"
        style={{ background: '#2A97DF', color: 'white', borderRadius: '2px' }}
      >
        Try again
      </button>
    </div>
  );
}

// ─── Notification Card ───────────────────────────────────────────────────────

interface NotifCardProps {
  notif: Notification;
  onClick: (notif: Notification) => void;
}

function NotifCard({ notif, onClick }: NotifCardProps) {
  const actor = notif.actor;
  const text = getNotifText(notif);
  const title = notif.title || actor?.display_name || 'PiChat';

  return (
    <button
      onClick={() => onClick(notif)}
      className="w-full flex items-start gap-3 px-4 py-3 transition-all text-left relative"
      style={{
        background: notif.is_read ? 'transparent' : 'rgba(42,151,223,0.05)',
        borderBottom: '0.7px solid var(--border)',
      }}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <div
          className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{ background: '#2A97DF' }}
        />
      )}

      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="w-11 h-11 overflow-hidden flex items-center justify-center text-white font-bold text-base"
          style={{ background: getAvatarColor(notif.actor_id || notif.id), borderRadius: '2px' }}
        >
          {actor?.avatar_url ? (
            <AppImage
              src={actor.avatar_url}
              alt={actor.display_name || 'User'}
              width={44}
              height={44}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{(actor?.display_name || title).charAt(0).toUpperCase()}</span>
          )}
        </div>
        {/* Type icon badge */}
        <div className="absolute -bottom-1 -right-1">
          <NotifIcon type={notif.notification_type} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground leading-snug flex-1" style={{ fontSize: '15px' }}>
            {actor?.is_verified && (
              <svg className="inline w-3.5 h-3.5 mr-0.5 -mt-0.5" viewBox="0 0 24 24" fill="#2A97DF">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-semibold">{title}</span>
            {' '}
            <span className="text-muted-foreground">{text}</span>
          </p>
          <span className="text-muted-foreground shrink-0 mt-0.5" style={{ fontSize: '10.5px' }}>{timeAgo(notif.created_at)}</span>
        </div>
        {notif.metadata?.preview && (
          <p className="text-muted-foreground mt-1 truncate" style={{ fontSize: '10.5px', maxWidth: '90%' }}>
            &ldquo;{String(notif.metadata.preview)}&rdquo;
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'follows', label: 'Follows' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'messages', label: 'Messages' },
  { id: 'community', label: 'Community' },
  { id: 'system', label: 'System' },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    loading,
    loadingMore,
    error,
    unreadCount,
    hasMore,
    filter,
    setFilter,
    markAsRead,
    markAllRead,
    loadMore,
    retry,
  } = useNotifications(user?.id || null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) router.push('/sign-up-login-screen');
  }, [user]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  // Deep-link navigation
  const handleNotificationClick = useCallback(async (notif: Notification) => {
    await markAsRead(notif.id);

    const { entity_id, entity_type, notification_type, actor } = notif;

    switch (notification_type) {
      case 'follow':
        if (actor?.username) router.push(`/profile/${actor.username}`);
        break;
      case 'like': case'comment': case'reply': case'mention':
        if (entity_id && entity_type === 'post') {
          router.push(`/post/${entity_id}`);
        } else if (entity_id && entity_type === 'comment') {
          router.push(`/post/${notif.metadata?.post_id || entity_id}`);
        } else {
          router.push('/social-feed');
        }
        break;
      case 'reel_like': router.push('/reels');
        break;
      case 'direct_message': router.push('/chats-screen');
        break;
      case 'community_post': case'community_invite': case'community_announcement': case'group_invite': {
        if (entity_id) {
          const { data: comm } = await supabase
            .from('communities')
            .select('slug')
            .eq('id', entity_id)
            .single();
          if (comm?.slug) {
            router.push(`/communities/${comm.slug}`);
          } else {
            router.push('/communities');
          }
        } else {
          router.push('/communities');
        }
        break;
      }
      case 'moderator_action': case'verification_update': router.push('/profile');
        break;
      case 'ai_assistant': router.push('/chats-screen');
        break;
      default:
        break;
    }
  }, [markAsRead, router, supabase]);

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        {/* Status bar */}
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
          <div
            className="px-4 pt-3 pb-0 shrink-0"
            style={{ background: 'var(--secondary)', borderBottom: '0.7px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-foreground" style={{ fontSize: '16px' }}>Notifications</h1>
                {unreadCount > 0 && (
                  <span
                    className="font-bold px-1.5 py-0.5"
                    style={{ background: '#2A97DF', color: 'white', minWidth: '20px', textAlign: 'center', fontSize: '10.5px', borderRadius: '2px' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="font-semibold transition-all"
                  style={{ color: '#2A97DF', fontSize: '10.5px' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="px-3 py-1.5 font-semibold transition-all shrink-0"
                  style={{
                    background: filter === f.id ? '#2A97DF' : 'var(--muted)',
                    color: filter === f.id ? 'white' : 'var(--muted-foreground)',
                    fontSize: '10.5px',
                    borderRadius: '2px',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ paddingBottom: '80px' }}>
            {loading ? (
              <div className="flex flex-col">
                {Array.from({ length: 8 }).map((_, i) => <NotifSkeleton key={i} />)}
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={retry} />
            ) : notifications.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <>
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <NotifCard
                      key={notif.id}
                      notif={notif}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <div
                      className="w-5 h-5 border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#2A97DF', borderTopColor: 'transparent', borderRadius: '2px' }}
                    />
                  </div>
                )}

                {!hasMore && notifications.length > 0 && (
                  <p className="text-center text-muted-foreground py-4" style={{ fontSize: '10.5px' }}>
                    You&apos;re all caught up
                  </p>
                )}
              </>
            )}
          </div>

          <BottomNav activeTab="notifications" />
        </div>
      </MobileFrame>
    </div>
  );
}
