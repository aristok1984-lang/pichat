'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import StatusBarTime from '@/components/StatusBarTime';

interface BookmarkedPost {
  id: string;
  post_id: string;
  created_at: string;
  posts: {
    id: string;
    content: string;
    image_url: string;
    likes_count: number;
    comments_count: number;
    created_at: string;
    user_profiles: {
      username: string;
      display_name: string;
      avatar_url: string;
      is_verified: boolean;
    };
  };
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function BookmarksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    fetchBookmarks();
  }, [user]);

  async function fetchBookmarks() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('post_bookmarks')
        .select(`
          id, post_id, created_at,
          posts:post_id(
            id, content, image_url, likes_count, comments_count, created_at,
            user_profiles:author_id(username, display_name, avatar_url, is_verified)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) setBookmarks(data as any);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function removeBookmark(bookmarkId: string) {
    await supabase.from('post_bookmarks').delete().eq('id', bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
  }

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3 pb-3 border-b border-border flex items-center gap-3" style={{ background: 'var(--secondary)' }}>
            <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Bookmarks</h1>
              <p className="text-xs text-muted-foreground">{bookmarks.length} saved posts</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : bookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--muted)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No bookmarks yet</p>
                <p className="text-xs text-muted-foreground">Save posts to read them later</p>
                <button
                  onClick={() => router.push('/social-feed')}
                  className="mt-4 px-5 py-2 text-sm font-semibold rounded-lg"
                  style={{ background: 'var(--primary)', color: 'white' }}
                >
                  Browse Feed
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {bookmarks.map((bookmark) => {
                  const post = bookmark.posts;
                  if (!post) return null;
                  const author = post.user_profiles;
                  return (
                    <div key={bookmark.id} className="rounded-xl border border-border overflow-hidden" style={{ background: 'var(--card)' }}>
                      {/* Author */}
                      <div className="flex items-center justify-between px-3 pt-3 pb-2">
                        <button
                          onClick={() => author?.username && router.push(`/profile/${author.username}`)}
                          className="flex items-center gap-2"
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: getAvatarColor(post.id) }}>
                            {author?.avatar_url ? (
                              <AppImage src={author.avatar_url} alt={author.display_name || 'User'} width={32} height={32} className="w-full h-full object-cover" />
                            ) : (
                              author?.display_name?.charAt(0) || '?'
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-foreground">{author?.display_name || 'User'}</span>
                              {author?.is_verified && (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--primary)">
                                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
                          </div>
                        </button>
                        <button
                          onClick={() => removeBookmark(bookmark.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                          title="Remove bookmark"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)" stroke="var(--primary)" strokeWidth="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Content */}
                      <div className="px-3 pb-2">
                        <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
                      </div>

                      {post.image_url && (
                        <div className="mx-3 mb-2 rounded-lg overflow-hidden">
                          <AppImage src={post.image_url} alt="Post image" width={300} height={180} className="w-full object-cover" />
                        </div>
                      )}

                      <div className="flex items-center gap-4 px-3 pb-3">
                        <span className="text-xs text-muted-foreground">❤️ {formatCount(post.likes_count || 0)}</span>
                        <span className="text-xs text-muted-foreground">💬 {formatCount(post.comments_count || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <BottomNav activeTab="profile" />
        </div>
      </MobileFrame>
    </div>
  );
}
