'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  banner_url: string;
  category: string;
  rules: string;
  tags: string[];
  owner_id: string;
  is_private: boolean;
  members_count: number;
  posts_count: number;
  created_at: string;
  updated_at: string;
}

const COMMUNITY_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

function getColor(str: string) {
  return COMMUNITY_COLORS[(str?.charCodeAt(0) || 0) % COMMUNITY_COLORS.length];
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function CommunityProfilePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { user, loading: authLoading } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'about'>('posts');
  const supabase = createClient();

  useEffect(() => {
    if (slug) fetchCommunity();
  }, [slug, user]);

  async function fetchCommunity() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !data) {
        router.push('/communities');
        return;
      }

      setCommunity(data);

      if (user) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('role')
          .eq('community_id', data.id)
          .eq('user_id', user.id)
          .single();
        if (memberData) {
          setIsMember(true);
          setMemberRole(memberData.role);
        } else {
          setIsMember(false);
          setMemberRole(null);
        }
      }
    } catch {
      router.push('/communities');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinLeave() {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    if (!community) return;
    setJoiningLoading(true);
    try {
      if (isMember) {
        await supabase.from('community_members').delete()
          .eq('community_id', community.id)
          .eq('user_id', user.id);
        setIsMember(false);
        setMemberRole(null);
        setCommunity(prev => prev ? { ...prev, members_count: Math.max(0, prev.members_count - 1) } : prev);
      } else {
        await supabase.from('community_members').insert({
          community_id: community.id,
          user_id: user.id,
          role: 'member',
        });
        setIsMember(true);
        setMemberRole('member');
        setCommunity(prev => prev ? { ...prev, members_count: prev.members_count + 1 } : prev);
      }
    } catch {
      // silent
    } finally {
      setJoiningLoading(false);
    }
  }

  const isOwnerOrAdmin = community && user && (
    community.owner_id === user.id ||
    memberRole === 'admin' ||
    memberRole === 'owner'
  );

  if (loading || authLoading) {
    return (
      <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
        <MobileFrame>
          <div className="flex items-center justify-center h-full">
            <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          </div>
        </MobileFrame>
      </div>
    );
  }

  if (!community) return null;

  const rulesLines = community.rules
    ? community.rules.split('\n').filter(Boolean)
    : [];

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Top bar */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-3 shrink-0" style={{ background: 'var(--secondary)' }}>
            <button
              onClick={() => router.push('/communities')}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{community.name}</p>
              <p className="text-xs text-muted-foreground">@{community.slug}</p>
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => router.push(`/communities/${slug}/edit`)}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '56px' }}>
            {/* Banner */}
            <div
              className="w-full relative"
              style={{ height: '110px', background: community.banner_url ? 'transparent' : `linear-gradient(135deg, ${getColor(community.name)}, ${getColor(community.name + '1')})` }}
            >
              {community.banner_url && (
                <img
                  src={community.banner_url}
                  alt={`${community.name} banner`}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {/* Avatar overlapping banner */}
              <div
                className="absolute -bottom-7 left-4 w-14 h-14 rounded-2xl border-2 overflow-hidden flex items-center justify-center text-xl font-bold text-white"
                style={{
                  borderColor: 'var(--secondary)',
                  background: community.avatar_url ? 'transparent' : getColor(community.name),
                }}
              >
                {community.avatar_url ? (
                  <img
                    src={community.avatar_url}
                    alt={`${community.name} avatar`}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  community.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Profile info */}
            <div className="px-4 pt-9 pb-3" style={{ background: 'var(--secondary)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground leading-tight">{community.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">@{community.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {community.is_private && (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                      Private
                    </span>
                  )}
                  {!community.is_private && (
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                      Public
                    </span>
                  )}
                  {user && (
                    <button
                      onClick={handleJoinLeave}
                      disabled={joiningLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                      style={{
                        background: isMember ? 'var(--muted)' : 'var(--primary)',
                        color: isMember ? 'var(--muted-foreground)' : 'white',
                        border: isMember ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {joiningLoading ? '…' : isMember ? 'Joined' : 'Join'}
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              {community.description && (
                <p className="text-sm text-foreground mt-2 leading-relaxed">{community.description}</p>
              )}

              {/* Meta pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                {community.category && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    {community.category}
                  </span>
                )}
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  {formatCount(community.members_count)} members
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  {formatCount(community.posts_count)} posts
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border" style={{ background: 'var(--secondary)' }}>
              {(['posts', 'about'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2.5 text-xs font-semibold capitalize transition-all duration-150"
                  style={{
                    color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  }}
                >
                  {tab === 'posts' ? 'Posts' : 'About'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'posts' && (
              <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: 'var(--muted)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">No posts yet</p>
                <p className="text-xs text-muted-foreground">Posts from this community will appear here.</p>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="px-4 py-4 space-y-4">
                {/* About section */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">About</h3>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    {community.description ? (
                      <p className="text-sm text-foreground leading-relaxed">{community.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No description provided.</p>
                    )}
                    <div className="space-y-2 pt-1">
                      {community.category && (
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                          </svg>
                          <span className="text-xs text-muted-foreground">Category: <span className="text-foreground font-medium">{community.category}</span></span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span className="text-xs text-muted-foreground">Created: <span className="text-foreground font-medium">{formatDate(community.created_at)}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                          {community.is_private ? (
                            <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>
                          ) : (
                            <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>
                          )}
                        </svg>
                        <span className="text-xs text-muted-foreground">
                          Visibility: <span className="text-foreground font-medium">{community.is_private ? 'Private' : 'Public'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xl font-bold text-foreground">{formatCount(community.members_count)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Members</p>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xl font-bold text-foreground">{formatCount(community.posts_count)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Posts</p>
                  </div>
                </div>

                {/* Tags */}
                {community.tags && community.tags.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Tags</h3>
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-2">
                      {community.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(42,171,238,0.1)', color: 'var(--primary)' }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rules */}
                {rulesLines.length > 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Community Rules</h3>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      {rulesLines.map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                            style={{ background: 'var(--primary)', fontSize: '10px' }}
                          >
                            {idx + 1}
                          </span>
                          <p className="text-sm text-foreground leading-relaxed">{rule}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rulesLines.length === 0 && (
                  <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Community Rules</h3>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-muted-foreground italic">No rules have been set for this community.</p>
                    </div>
                  </div>
                )}

                {/* Edit button for owner/admin */}
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => router.push(`/communities/${slug}/edit`)}
                    className="w-full py-3 text-sm font-semibold rounded-xl transition-all duration-150 flex items-center justify-center gap-2"
                    style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit Community Profile
                  </button>
                )}
              </div>
            )}
          </div>

          <BottomNav />
        </div>
      </MobileFrame>
    </div>
  );
}
