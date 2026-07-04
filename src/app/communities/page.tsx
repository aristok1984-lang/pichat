'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import StatusBarTime from '@/components/StatusBarTime';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string;
  members_count: number;
  posts_count: number;
  tags: string[];
  owner_id: string;
  is_private: boolean;
  created_at: string;
}

const COMMUNITY_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

function getCommunityColor(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % COMMUNITY_COLORS.length;
  return COMMUNITY_COLORS[idx];
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Community Avatar ─────────────────────────────────────────────────────────
function CommunityAvatar({ name, avatarUrl, color }: { name: string; avatarUrl: string | null; color: string }) {
  const [imgError, setImgError] = useState(false);
  const showImage = avatarUrl && avatarUrl.trim() !== '' && !imgError;
  return (
    <div
      className="w-11 h-11 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden"
      style={{ background: color, borderRadius: '2px', fontSize: '16px' }}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgError(true)}
        />
      ) : (
        name.charAt(0)
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunitiesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchCommunities();
    if (user) fetchMyCommunities();
  }, [user]);

  async function fetchCommunities() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .order('members_count', { ascending: false })
        .limit(30);
      if (data) setCommunities(data);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyCommunities() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user.id);
      if (data) setMyCommunities(data.map((m: any) => m.community_id));
    } catch (err) {
      // silent
    }
  }

  async function handleJoin(communityId: string) {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    const isJoined = myCommunities.includes(communityId);
    try {
      if (isJoined) {
        await supabase.from('community_members').delete()
          .eq('community_id', communityId).eq('user_id', user.id);
        setMyCommunities(prev => prev.filter(id => id !== communityId));
      } else {
        await supabase.from('community_members').insert({ community_id: communityId, user_id: user.id });
        setMyCommunities(prev => [...prev, communityId]);
      }
    } catch (err) {
      // silent
    }
  }

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const displayCommunities = activeTab === 'joined'
    ? filteredCommunities.filter(c => myCommunities.includes(c.id))
    : filteredCommunities;

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
          <div className="px-4 pt-3 pb-3" style={{ background: 'var(--secondary)', borderBottom: '0.7px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-bold text-foreground" style={{ fontSize: '16px' }}>Communities</h1>
              <div className="flex items-center gap-2">
                {user && (
                  <button
                    onClick={() => router.push('/my-communities')}
                    className="flex items-center gap-1 px-2.5 py-1.5 font-semibold"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', fontSize: '12px', borderRadius: '2px', border: '0.7px solid var(--border)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Manage
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!user) { router.push('/sign-up-login-screen'); return; }
                    router.push('/communities/create');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 font-semibold"
                  style={{ background: 'var(--primary)', color: 'white', fontSize: '13px', borderRadius: '2px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search communities…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '15px', borderRadius: '2px' }}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1">
              {(['discover', 'joined'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-1.5 font-semibold capitalize transition-all duration-150"
                  style={{
                    background: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
                    color: activeTab === tab ? 'white' : 'var(--muted-foreground)',
                    fontSize: '13px',
                    borderRadius: '2px',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Community list */}
          <div className="flex-1 overflow-y-auto pb-20 relative">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : displayCommunities.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--muted)', borderRadius: '2px' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="font-semibold text-foreground mb-1" style={{ fontSize: '15px' }}>
                  {activeTab === 'joined' ? 'No communities joined yet' : 'No communities found'}
                </p>
                <p className="text-muted-foreground" style={{ fontSize: '13px' }}>
                  {activeTab === 'joined' ? 'Discover and join communities below' : 'Try a different search term'}
                </p>
                {activeTab === 'joined' && (
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="mt-3 px-4 py-2 font-semibold"
                    style={{ background: 'var(--primary)', color: 'white', fontSize: '13px', borderRadius: '2px' }}
                  >
                    Discover Communities
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {displayCommunities.map((community) => {
                  const isJoined = myCommunities.includes(community.id);
                  const color = getCommunityColor(community.name);
                  return (
                    <div
                      key={community.id}
                      className="relative flex items-center gap-3 p-3 cursor-pointer transition-all duration-150"
                      style={{
                        background: 'var(--card)',
                        border: '0.7px solid var(--border)',
                        borderRadius: '2px',
                      }}
                      onClick={() => router.push(`/communities/${community.slug}`)}
                    >
                      {/* Avatar */}
                      <CommunityAvatar
                        name={community.name}
                        avatarUrl={community.avatar_url}
                        color={color}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0" style={{ paddingRight: '60px' }}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-bold text-foreground truncate" style={{ fontSize: '15px' }}>{community.name}</span>
                          {community.is_private && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate mb-1" style={{ fontSize: '13px' }}>{community.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground" style={{ fontSize: '10.5px' }}>{formatCount(community.members_count)} members</span>
                          {community.tags?.slice(0, 2).map(tag => (
                            <span key={tag} style={{ fontSize: '10.5px', padding: '2px 6px', background: 'var(--muted)', color: 'var(--primary)', borderRadius: '2px' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Join button — absolutely positioned, top-right corner */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleJoin(community.id); }}
                        className="font-semibold transition-all duration-150"
                        style={{
                          position: 'absolute',
                          top: '7px',
                          right: '7px',
                          background: isJoined ? 'var(--muted)' : 'var(--primary)',
                          color: isJoined ? 'var(--muted-foreground)' : 'white',
                          border: isJoined ? '1px solid var(--border)' : 'none',
                          fontSize: '12px',
                          borderRadius: '2px',
                          padding: '4px 10px',
                        }}
                      >
                        {isJoined ? 'Joined' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <BottomNav activeTab="contacts" />
        </div>
      </MobileFrame>
    </div>
  );
}
