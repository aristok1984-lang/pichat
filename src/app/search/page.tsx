'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import StatusBarTime from '@/components/StatusBarTime';

type SearchTab = 'all' | 'users' | 'communities' | 'posts' | 'hashtags';

interface UserResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
  followers_count: number;
}

interface CommunityResult {
  id: string;
  name: string;
  slug: string;
  description: string;
  members_count: number;
  tags: string[];
}

interface PostResult {
  id: string;
  content: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: { username: string; display_name: string; avatar_url: string } | null;
}

interface HashtagResult {
  tag: string;
  count: number;
}

const AVATAR_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function getColor(str: string) {
  return AVATAR_COLORS[(str?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [communities, setCommunities] = useState<CommunityResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [hashtags, setHashtags] = useState<HashtagResult[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<HashtagResult[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<Set<string>>(new Set());
  const supabase = createClient();

  // Fetch blocked user IDs once on mount
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

  useEffect(() => {
    fetchTrendingHashtags();
  }, []);

  // Fetch who the current user already follows
  useEffect(() => {
    if (!user) return;
    async function fetchFollowing() {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user!.id);
      if (data) setFollowedIds(new Set(data.map((r: any) => r.following_id)));
    }
    fetchFollowing();
  }, [user]);

  // Fetch communities the user has joined
  useEffect(() => {
    if (!user) return;
    async function fetchJoined() {
      const { data } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user!.id);
      if (data) setJoinedCommunityIds(new Set(data.map((r: any) => r.community_id)));
    }
    fetchJoined();
  }, [user]);

  async function fetchTrendingHashtags() {
    try {
      const { data } = await supabase
        .from('posts')
        .select('tags')
        .not('tags', 'is', null)
        .limit(50);
      if (data) {
        const tagMap: Record<string, number> = {};
        data.forEach((p: any) => {
          (p.tags || []).forEach((t: string) => {
            tagMap[t] = (tagMap[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(tagMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }));
        setTrendingHashtags(sorted);
      }
    } catch (err) {
      // silent
    }
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setCommunities([]);
      setPosts([]);
      setHashtags([]);
      return;
    }
    setLoading(true);
    const term = q.trim().toLowerCase();
    try {
      const [usersRes, commRes, postsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, is_verified, followers_count')
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(10),
        supabase
          .from('communities')
          .select('id, name, slug, description, members_count, tags')
          .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
          .limit(10),
        supabase
          .from('posts')
          .select('id, content, tags, likes_count, comments_count, created_at, author:user_profiles!posts_author_id_fkey(username, display_name, avatar_url)')
          .or(`content.ilike.%${term}%`)
          .limit(10),
      ]);

      // Filter out blocked users from user results
      const filteredUsers = (usersRes.data || []).filter(
        (u: any) => !blockedIds.has(u.id)
      );
      // Filter out posts from blocked users
      const filteredPosts = (postsRes.data || []).filter(
        (p: any) => {
          const authorId = (p.author as any)?.id || p.author_id;
          return !authorId || !blockedIds.has(authorId);
        }
      );

      setUsers(filteredUsers as UserResult[]);
      setCommunities(commRes.data || []);
      setPosts(filteredPosts as PostResult[]);

      // Extract hashtags from posts
      const allPosts = filteredPosts;
      const tagMap: Record<string, number> = {};
      allPosts.forEach((p: any) => {
        (p.tags || []).forEach((t: string) => {
          if (t.toLowerCase().includes(term)) {
            tagMap[t] = (tagMap[t] || 0) + 1;
          }
        });
      });
      setHashtags(Object.entries(tagMap).map(([tag, count]) => ({ tag, count })));
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [blockedIds]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const hasResults = users.length > 0 || communities.length > 0 || posts.length > 0 || hashtags.length > 0;

  const TABS: { id: SearchTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'People' },
    { id: 'communities', label: 'Communities' },
    { id: 'posts', label: 'Posts' },
    { id: 'hashtags', label: 'Tags' },
  ];

  async function handleFollow(e: React.MouseEvent, userId: string) {
    e.stopPropagation();
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isFollowing = followedIds.has(userId);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId);
      setFollowedIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId });
      setFollowedIds(prev => new Set([...prev, userId]));
    }
  }

  async function handleJoinCommunity(e: React.MouseEvent, community: CommunityResult) {
    e.stopPropagation();
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isJoined = joinedCommunityIds.has(community.id);
    if (isJoined) {
      await supabase.from('community_members').delete().eq('community_id', community.id).eq('user_id', user.id);
      setJoinedCommunityIds(prev => { const next = new Set(prev); next.delete(community.id); return next; });
    } else {
      await supabase.from('community_members').insert({ community_id: community.id, user_id: user.id });
      setJoinedCommunityIds(prev => new Set([...prev, community.id]));
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
          <div className="px-4 pt-3 pb-3" style={{ background: 'var(--secondary)', borderBottom: '0.7px solid var(--border)' }}>
            <h1 className="font-bold text-foreground mb-3" style={{ fontSize: '16px' }}>Search</h1>
            {/* Search input */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search users, communities, posts…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '15px', borderRadius: '2px' }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="shrink-0 px-3 py-1.5 font-semibold transition-all duration-150"
                  style={{
                    background: activeTab === tab.id ? 'var(--primary)' : 'var(--muted)',
                    color: activeTab === tab.id ? 'white' : 'var(--muted-foreground)',
                    fontSize: '12px',
                    borderRadius: '2px',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto pb-20">
            {loading && (
              <div className="flex items-center justify-center h-20">
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            )}

            {!loading && !query && (
              <div className="p-4">
                <p className="text-muted-foreground mb-3" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trending Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {trendingHashtags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      onClick={() => { setQuery(tag); setActiveTab('hashtags'); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 font-semibold transition-all duration-150 hover:opacity-80"
                      style={{ background: 'var(--muted)', color: 'var(--primary)', fontSize: '12px', borderRadius: '2px' }}
                    >
                      <span>#{tag}</span>
                      <span className="text-muted-foreground">{formatCount(count)}</span>
                    </button>
                  ))}
                  {trendingHashtags.length === 0 && (
                    <p className="text-muted-foreground" style={{ fontSize: '13px' }}>No trending tags yet</p>
                  )}
                </div>

                <p className="text-muted-foreground mt-5 mb-3" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Discover</p>
                <div className="space-y-1">
                  {[
                    { icon: '👥', label: 'Find people to follow', action: () => setActiveTab('users') },
                    { icon: '🏘️', label: 'Explore communities', action: () => router.push('/communities') },
                    { icon: '📰', label: 'Browse the feed', action: () => router.push('/social-feed') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 p-3 text-left transition-all duration-150 hover:opacity-80"
                      style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px' }}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium text-foreground" style={{ fontSize: '15px' }}>{item.label}</span>
                      <svg className="ml-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && query && !hasResults && (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--muted)', borderRadius: '2px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p className="font-semibold text-foreground mb-1" style={{ fontSize: '15px' }}>No results for &ldquo;{query}&rdquo;</p>
                <p className="text-muted-foreground" style={{ fontSize: '13px' }}>Try different keywords or check spelling</p>
              </div>
            )}

            {!loading && query && hasResults && (
              <div className="p-3 space-y-4">
                {/* Users */}
                {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
                  <section>
                    {activeTab === 'all' && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-muted-foreground" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>People</p>
                        {users.length >= 3 && (
                          <button onClick={() => setActiveTab('users')} className="font-semibold" style={{ color: 'var(--primary)', fontSize: '12px' }}>See all</button>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      {(activeTab === 'all' ? users.slice(0, 3) : users).map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 p-3 cursor-pointer transition-all duration-150"
                          style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px' }}
                          onClick={() => router.push(`/profile/${u.username}`)}
                        >
                          <div
                            className="w-10 h-10 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
                            style={{ background: getColor(u.username), borderRadius: '50%' }}
                          >
                            {u.avatar_url ? (
                              <AppImage src={u.avatar_url} alt={`${u.display_name} avatar`} width={40} height={40} className="w-full h-full object-cover" />
                            ) : (
                              u.display_name?.charAt(0)?.toUpperCase() || '?'
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-foreground truncate" style={{ fontSize: '15px' }}>{u.display_name}</span>
                              {u.is_verified && (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)">
                                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                                </svg>
                              )}
                            </div>
                            <p className="text-muted-foreground" style={{ fontSize: '10.5px' }}>@{u.username} · {formatCount(u.followers_count)} followers</p>
                          </div>
                          <button
                            className="shrink-0 px-3 py-1 font-semibold transition-all duration-150"
                            style={{
                              background: followedIds.has(u.id) ? 'var(--muted)' : 'var(--primary)',
                              color: followedIds.has(u.id) ? 'var(--foreground)' : 'white',
                              border: followedIds.has(u.id) ? '1px solid var(--border)' : 'none',
                              fontSize: '12px',
                              borderRadius: '2px',
                            }}
                            onClick={(e) => handleFollow(e, u.id)}
                          >
                            {u.id === user?.id ? 'You' : followedIds.has(u.id) ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Communities */}
                {(activeTab === 'all' || activeTab === 'communities') && communities.length > 0 && (
                  <section>
                    {activeTab === 'all' && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-muted-foreground" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Communities</p>
                        {communities.length >= 3 && (
                          <button onClick={() => setActiveTab('communities')} className="font-semibold" style={{ color: 'var(--primary)', fontSize: '12px' }}>See all</button>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      {(activeTab === 'all' ? communities.slice(0, 3) : communities).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 cursor-pointer transition-all duration-150"
                          style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px' }}
                          onClick={() => router.push(`/communities/${c.slug}`)}
                        >
                          <div
                            className="w-10 h-10 flex items-center justify-center font-bold text-white shrink-0"
                            style={{ background: getColor(c.name), borderRadius: '2px', fontSize: '15px' }}
                          >
                            {c.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate" style={{ fontSize: '15px' }}>{c.name}</p>
                            <p className="text-muted-foreground" style={{ fontSize: '10.5px' }}>{formatCount(c.members_count)} members</p>
                          </div>
                          <button
                            className="shrink-0 px-3 py-1 font-semibold transition-all duration-150"
                            style={{
                              background: joinedCommunityIds.has(c.id) ? 'var(--muted)' : 'var(--primary)',
                              color: joinedCommunityIds.has(c.id) ? 'var(--foreground)' : 'white',
                              border: joinedCommunityIds.has(c.id) ? '1px solid var(--border)' : 'none',
                              fontSize: '12px',
                              borderRadius: '2px',
                            }}
                            onClick={(e) => handleJoinCommunity(e, c)}
                          >
                            {joinedCommunityIds.has(c.id) ? 'Joined' : 'Join'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Posts */}
                {(activeTab === 'all' || activeTab === 'posts') && posts.length > 0 && (
                  <section>
                    {activeTab === 'all' && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-muted-foreground" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Posts</p>
                        {posts.length >= 3 && (
                          <button onClick={() => setActiveTab('posts')} className="font-semibold" style={{ color: 'var(--primary)', fontSize: '12px' }}>See all</button>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      {(activeTab === 'all' ? posts.slice(0, 3) : posts).map((p) => (
                        <div
                          key={p.id}
                          className="p-3 cursor-pointer transition-all duration-150"
                          style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px' }}
                          onClick={() => router.push(`/post/${p.id}`)}
                        >
                          {p.author && (
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-7 h-7 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
                                style={{ background: getColor(p.author.username), borderRadius: '50%', fontSize: '11px' }}
                              >
                                {p.author.avatar_url ? (
                                  <AppImage src={p.author.avatar_url} alt={`${p.author.display_name} avatar`} width={28} height={28} className="w-full h-full object-cover" />
                                ) : (
                                  p.author.display_name?.charAt(0)?.toUpperCase() || '?'
                                )}
                              </div>
                              <span className="font-semibold text-foreground" style={{ fontSize: '13px' }}>{p.author.display_name}</span>
                              <span className="text-muted-foreground" style={{ fontSize: '10.5px' }}>@{p.author.username}</span>
                            </div>
                          )}
                          <p className="text-foreground leading-relaxed line-clamp-2" style={{ fontSize: '15px' }}>{p.content}</p>
                          {p.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="font-semibold" style={{ color: 'var(--primary)', fontSize: '13px' }}>#{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-muted-foreground" style={{ fontSize: '10.5px' }}>
                            <span>❤️ {formatCount(p.likes_count)}</span>
                            <span>💬 {formatCount(p.comments_count)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Hashtags */}
                {(activeTab === 'all' || activeTab === 'hashtags') && hashtags.length > 0 && (
                  <section>
                    {activeTab === 'all' && (
                      <p className="text-muted-foreground mb-2" style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hashtags</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map(({ tag, count }) => (
                        <button
                          key={tag}
                          onClick={() => { setQuery(tag); setActiveTab('posts'); }}
                          className="flex items-center gap-1.5 px-3 py-2 font-semibold transition-all duration-150 hover:opacity-80"
                          style={{ background: 'var(--card)', color: 'var(--primary)', border: '0.7px solid var(--border)', fontSize: '12px', borderRadius: '2px' }}
                        >
                          <span>#{tag}</span>
                          <span className="text-muted-foreground">{formatCount(count)} posts</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          <BottomNav activeTab="search" />
        </div>
      </MobileFrame>
    </div>
  );
}
