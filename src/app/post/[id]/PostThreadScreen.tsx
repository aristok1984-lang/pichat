'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import StatusBarTime from '@/components/StatusBarTime';

interface Post {
  id: string;
  content: string;
  title?: string;
  image_url: string | null;
  video_url?: string | null;
  link_url?: string | null;
  poll_options?: { text: string; votes: number }[] | null;
  post_type?: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  created_at: string;
  author_id: string;
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

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  likes_count: number;
  parent_post_id?: string | null;
  author?: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
  replies?: Comment[];
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
function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PostThreadScreen({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ avatar_url?: string; display_name?: string } | null>(null);
  const [pollVoted, setPollVoted] = useState<number | null>(null);
  const [pollOptions, setPollOptions] = useState<{ text: string; votes: number }[]>([]);
  const supabase = createClient();

  const fetchPost = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select('*, user_profiles(username, display_name, avatar_url, is_verified), communities(name, slug)')
        .eq('id', postId)
        .single();
      if (data) {
        setPost(data as Post);
        if ((data as any).poll_options) setPollOptions((data as any).poll_options);
      }
    } catch {}
    finally { setLoading(false); }
  }, [postId]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select('id, content, created_at, author_id, likes_count, parent_post_id, user_profiles:author_id(username, display_name, avatar_url)')
        .eq('parent_post_id', postId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        setComments(data.map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author_id: c.author_id,
          likes_count: c.likes_count || 0,
          parent_post_id: c.parent_post_id,
          author: c.user_profiles,
        })));
      }
    } catch {}
    finally { setCommentsLoading(false); }
  }, [postId]);

  useEffect(() => { fetchPost(); fetchComments(); }, [fetchPost, fetchComments]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).single(),
      supabase.from('post_bookmarks').select('post_id').eq('post_id', postId).eq('user_id', user.id).single(),
      supabase.from('user_profiles').select('avatar_url, display_name').eq('id', user.id).single(),
    ]).then(([likeRes, bookmarkRes, profileRes]) => {
      if (likeRes.data) setIsLiked(true);
      if (bookmarkRes.data) setIsBookmarked(true);
      if (profileRes.data) setCurrentUserProfile(profileRes.data);
    });
  }, [user, postId]);

  useEffect(() => {
    const channel = supabase
      .channel(`post_thread_${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `parent_post_id=eq.${postId}` }, async (payload) => {
        const { data } = await supabase
          .from('posts')
          .select('id, content, created_at, author_id, likes_count, parent_post_id, user_profiles:author_id(username, display_name, avatar_url)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setComments(prev => [...prev, {
            id: (data as any).id,
            content: (data as any).content,
            created_at: (data as any).created_at,
            author_id: (data as any).author_id,
            likes_count: (data as any).likes_count || 0,
            parent_post_id: (data as any).parent_post_id,
            author: (data as any).user_profiles,
          }]);
          setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  async function handleLike() {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setPost(prev => prev ? { ...prev, likes_count: newLiked ? prev.likes_count + 1 : Math.max(0, prev.likes_count - 1) } : prev);
    try {
      if (newLiked) await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      else await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
    } catch {}
  }

  async function handleBookmark() {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const newBookmarked = !isBookmarked;
    setIsBookmarked(newBookmarked);
    try {
      if (newBookmarked) await supabase.from('post_bookmarks').insert({ post_id: postId, user_id: user.id });
      else await supabase.from('post_bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
    } catch {}
  }

  async function handleSubmitComment() {
    if (!commentText.trim() || !user || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from('posts').insert({
        author_id: user.id,
        content: commentText.trim(),
        parent_post_id: replyingTo || postId,
      });
      setCommentText('');
      setReplyingTo(null);
    } catch {}
    finally { setSubmitting(false); }
  }

  function handlePollVote(idx: number) {
    if (pollVoted !== null) return;
    setPollVoted(idx);
    setPollOptions(prev => prev.map((o, i) => i === idx ? { ...o, votes: o.votes + 1 } : o));
  }

  const totalPollVotes = pollOptions.reduce((sum, o) => sum + o.votes, 0);
  const author = post?.user_profiles;
  const username = author?.username || 'unknown';
  const displayName = author?.display_name || username;

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
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: '#17212B', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
          >
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{ color: '#7C8FA3' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <h1 style={{ color: '#E8EDF2', fontSize: '15px', fontWeight: 600 }}>Thread</h1>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pb-24" style={{ background: '#0E1621' }}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : !post ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <p style={{ color: '#E8EDF2', fontSize: '15px', fontWeight: 600 }}>Post not found</p>
                <p style={{ color: '#7C8FA3', fontSize: '13px' }} className="mt-1">This post may have been deleted</p>
              </div>
            ) : (
              <>
                {/* Main post */}
                <div
                  className="px-4 pt-4 pb-3"
                  style={{ background: '#17212B', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
                >
                  {/* Community */}
                  {post.communities && (
                    <button
                      onClick={() => router.push(`/communities/${post.communities!.slug}`)}
                      className="flex items-center gap-1.5 mb-2 hover:opacity-80"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      <span style={{ color: '#2A97DF', fontSize: '11px', fontWeight: 600 }}>c/{post.communities.name}</span>
                    </button>
                  )}

                  {/* Author */}
                  <div className="flex items-center justify-between mb-3">
                    <button className="flex items-center gap-2.5" onClick={() => router.push(`/profile/${username}`)}>
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: getAvatarColor(username) }}
                      >
                        {author?.avatar_url ? (
                          <AppImage src={author.avatar_url} alt={`${displayName} avatar`} width={40} height={40} className="w-full h-full object-cover" />
                        ) : displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span style={{ color: '#E8EDF2', fontSize: '14px', fontWeight: 600 }}>{displayName}</span>
                          {author?.is_verified && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#2A97DF">
                              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                            </svg>
                          )}
                        </div>
                        <span style={{ color: '#7C8FA3', fontSize: '11px' }}>@{username}</span>
                      </div>
                    </button>
                    <button style={{ color: '#7C8FA3' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                  </div>

                  {/* Title */}
                  {post.title && (
                    <p style={{ color: '#E8EDF2', fontSize: '16px', fontWeight: 500, lineHeight: 1.4 }} className="mb-2">
                      {post.title}
                    </p>
                  )}

                  {/* Content */}
                  {post.content && (
                    <p style={{ color: '#D7DDE5', fontSize: '15px', lineHeight: 1.6 }} className="mb-3">
                      {post.content}
                    </p>
                  )}

                  {/* Tags */}
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.tags.map((tag) => (
                        <button key={tag} onClick={() => router.push(`/hashtag/${tag}`)} style={{ color: '#2A97DF', fontSize: '13px', fontWeight: 600 }}>
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Link */}
                  {post.post_type === 'link' && post.link_url && (
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 mb-3"
                      style={{ background: 'rgba(42,151,223,0.08)', border: '0.7px solid rgba(42,151,223,0.25)', borderRadius: '2px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                      </svg>
                      <a href={post.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#2A97DF', fontSize: '13px' }} className="truncate hover:underline">
                        {post.link_url}
                      </a>
                    </div>
                  )}

                  {/* Poll */}
                  {post.post_type === 'poll' && pollOptions.length > 0 && (
                    <div className="space-y-1.5 mb-3">
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
                                className="absolute inset-y-0 left-0"
                                style={{ width: `${pct}%`, background: isWinner ? 'rgba(42,151,223,0.2)' : 'rgba(255,255,255,0.05)' }}
                              />
                            )}
                            <div className="relative flex items-center justify-between">
                              <span style={{ color: '#E8EDF2', fontSize: '14px' }}>{option.text}</span>
                              {pollVoted !== null && <span style={{ color: '#7C8FA3', fontSize: '12px', fontWeight: 600 }}>{pct}%</span>}
                            </div>
                          </button>
                        );
                      })}
                      {pollVoted !== null && <p style={{ color: '#7C8FA3', fontSize: '11px' }}>{totalPollVotes} votes</p>}
                    </div>
                  )}

                  {/* Image */}
                  {post.image_url && (
                    <div className="mb-3 overflow-hidden" style={{ borderRadius: '2px', background: '#242F3C' }}>
                      <AppImage src={post.image_url} alt={`Post by ${displayName}`} width={358} height={260} className="w-full object-cover" />
                    </div>
                  )}

                  {/* Full timestamp */}
                  <p style={{ color: '#7C8FA3', fontSize: '11px' }} className="mb-3">{formatFullDate(post.created_at)}</p>

                  {/* Stats row */}
                  <div
                    className="flex items-center gap-4 py-2.5"
                    style={{ borderTop: '0.7px solid rgba(42,58,74,0.8)', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
                  >
                    <div className="flex items-center gap-1">
                      <span style={{ color: '#E8EDF2', fontSize: '14px', fontWeight: 700 }}>{formatCount(post.likes_count)}</span>
                      <span style={{ color: '#7C8FA3', fontSize: '12px' }}>upvotes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span style={{ color: '#E8EDF2', fontSize: '14px', fontWeight: 700 }}>{formatCount(post.comments_count)}</span>
                      <span style={{ color: '#7C8FA3', fontSize: '12px' }}>comments</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span style={{ color: '#E8EDF2', fontSize: '14px', fontWeight: 700 }}>{formatCount(post.shares_count)}</span>
                      <span style={{ color: '#7C8FA3', fontSize: '12px' }}>shares</span>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center justify-around pt-2">
                    <button
                      onClick={handleLike}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                      style={{ color: isLiked ? '#2A97DF' : '#7C8FA3' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={isLiked ? '#2A97DF' : 'none'}
                        stroke={isLiked ? '#2A97DF' : 'currentColor'}
                        strokeWidth="2"
                      >
                        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                        <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatCount(post.likes_count)}</span>
                    </button>

                    <button
                      onClick={() => document.getElementById('comment-input')?.focus()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                      style={{ color: '#7C8FA3' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>Reply</span>
                    </button>

                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                      style={{ color: '#7C8FA3' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>Share</span>
                    </button>

                    <button
                      onClick={handleBookmark}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                      style={{ color: isBookmarked ? '#2A97DF' : '#7C8FA3' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={isBookmarked ? '#2A97DF' : 'none'}
                        stroke={isBookmarked ? '#2A97DF' : 'currentColor'}
                        strokeWidth="2"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Reply input */}
                {user && (
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: '#17212B', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                      style={{ background: '#2A97DF' }}
                    >
                      {currentUserProfile?.avatar_url ? (
                        <AppImage src={currentUserProfile.avatar_url} alt="Your avatar" width={32} height={32} className="w-full h-full object-cover" />
                      ) : (
                        currentUserProfile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'
                      )}
                    </div>
                    <input
                      id="comment-input"
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                      placeholder={replyingTo ? 'Write a reply…' : 'Add a comment…'}
                      className="flex-1 px-3 py-2 text-sm outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.7px solid rgba(42,58,74,0.7)',
                        borderRadius: '2px',
                        color: '#E8EDF2',
                      }}
                    />
                    <button
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim() || submitting}
                      className="px-3 py-2 text-xs font-bold transition-all"
                      style={{
                        background: commentText.trim() ? 'linear-gradient(135deg, #2A97DF, #52C5FC)' : 'rgba(255,255,255,0.06)',
                        color: commentText.trim() ? 'white' : '#7C8FA3',
                        borderRadius: '2px',
                      }}
                    >
                      {submitting ? '…' : 'Post'}
                    </button>
                  </div>
                )}

                {/* Comments */}
                <div>
                  <div className="px-4 py-2.5" style={{ borderBottom: '0.7px solid rgba(42,58,74,0.5)' }}>
                    <span style={{ color: '#7C8FA3', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {commentsLoading ? 'Loading…' : `${comments.length} ${comments.length === 1 ? 'Comment' : 'Comments'}`}
                    </span>
                  </div>

                  {commentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A97DF" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                        <path d="M21 12a9 9 0 00-9-9" />
                      </svg>
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                      <p style={{ color: '#7C8FA3', fontSize: '14px' }}>No comments yet. Be the first!</p>
                    </div>
                  ) : (
                    <div>
                      {comments.map((comment) => (
                        <CommentRow
                          key={comment.id}
                          comment={comment}
                          onReply={(id) => { setReplyingTo(id); document.getElementById('comment-input')?.focus(); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <BottomNav activeTab="feed" />
        </div>
      </MobileFrame>
    </div>
  );
}

function CommentRow({ comment, onReply, depth = 0 }: { comment: Comment; onReply: (id: string) => void; depth?: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes_count);
  const router = useRouter();
  const commentUsername = comment.author?.username || 'unknown';
  const commentDisplayName = comment.author?.display_name || commentUsername;

  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3"
      style={{
        borderBottom: '0.7px solid rgba(42,58,74,0.4)',
        paddingLeft: depth > 0 ? `${16 + depth * 20}px` : '16px',
      }}
    >
      {/* Thread line + avatar */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
          style={{ background: getAvatarColor(comment.author_id) }}
        >
          {comment.author?.avatar_url ? (
            <AppImage src={comment.author.avatar_url} alt={commentDisplayName} width={32} height={32} className="w-full h-full object-cover" />
          ) : commentDisplayName.charAt(0).toUpperCase()}
        </div>
        {depth === 0 && (
          <div className="w-px flex-1 mt-1" style={{ background: 'rgba(42,58,74,0.6)', minHeight: '12px' }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <button
            onClick={() => router.push(`/profile/${commentUsername}`)}
            style={{ color: '#E8EDF2', fontSize: '13px', fontWeight: 600 }}
            className="hover:underline"
          >
            {commentDisplayName}
          </button>
          <span style={{ color: '#7C8FA3', fontSize: '10.5px' }}>· {timeAgo(comment.created_at)}</span>
        </div>
        <p style={{ color: '#D7DDE5', fontSize: '14px', lineHeight: 1.5 }}>{comment.content}</p>

        {/* Comment actions */}
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={() => { setLiked(l => !l); setLikeCount(c => liked ? c - 1 : c + 1); }}
            className="flex items-center gap-1 transition-all"
            style={{ color: liked ? '#2A97DF' : '#7C8FA3' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? '#2A97DF' : 'none'} stroke={liked ? '#2A97DF' : 'currentColor'} strokeWidth="2">
              <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
            </svg>
            {likeCount > 0 && <span style={{ fontSize: '11px', fontWeight: 500 }}>{likeCount}</span>}
          </button>
          {depth < 2 && (
            <button
              onClick={() => onReply(comment.id)}
              style={{ color: '#7C8FA3', fontSize: '11px', fontWeight: 500 }}
              className="hover:text-white transition-colors"
            >
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
