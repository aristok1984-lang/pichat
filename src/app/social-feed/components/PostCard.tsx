'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import CommentsSection from '@/components/comments/CommentsSection';

export interface Post {
  id: string;
  content: string;
  title?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  link_url?: string | null;
  post_type?: string | null;
  tags?: string[] | null;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  shares_count?: number;
  created_at: string;
  author_id: string;
  community_id?: string | null;
  is_spoiler?: boolean;
  user_profiles?: {
    username: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
  } | null;
  communities?: {
    name: string;
    slug: string;
  } | null;
}

interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onLike?: () => void;
  onBookmark?: () => void;
  currentUserId?: string;
}

const AVATAR_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
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

export default function PostCard({ post, isLiked = false, isBookmarked = false, onLike, onBookmark, currentUserId }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [liveCommentsCount, setLiveCommentsCount] = useState(post.comments_count);
  const router = useRouter();

  const author = post.user_profiles;
  const username = author?.username || 'unknown';
  const displayName = author?.display_name || username;
  const avatarColor = getAvatarColor(username);

  return (
    <div
      className="animate-fade-in overflow-hidden"
      style={{
        background: '#17212B',
        border: '0.7px solid rgba(42,58,74,0.8)',
        borderRadius: '2px',
        transition: 'box-shadow 0.2s ease',
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
          <button onClick={() => router.push(`/post/${post.id}`)} className="text-left w-full">
            <p style={{ color: '#E8EDF2', fontSize: '15px', fontWeight: 500, lineHeight: 1.4 }}>
              {post.title}
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
          {post.tags && post.tags.length > 0 && (
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
        <button onClick={() => setShowComments((v) => !v)} style={{ color: '#7C8FA3', fontSize: '11px' }} className="hover:underline">
          {formatCount(liveCommentsCount)} comments
        </button>
      </div>

      {/* Divider */}
      <div className="mx-3" style={{ height: '0.7px', background: 'rgba(42,58,74,0.8)' }} />

      {/* Action row */}
      <div className="flex items-center px-1 py-1 gap-0.5">
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
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all"
          style={{ color: showComments ? '#2A97DF' : '#7C8FA3' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatCount(liveCommentsCount)}</span>
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

      {/* Comments Section — Reddit-style */}
      {showComments && (
        <div
          style={{
            borderTop: '0.7px solid rgba(42,58,74,0.8)',
            marginTop: '2px',
          }}
        >
          <CommentsSection
            postId={post.id}
            initialCommentsCount={post.comments_count}
            onCountChange={setLiveCommentsCount}
          />
        </div>
      )}
    </div>
  );
}