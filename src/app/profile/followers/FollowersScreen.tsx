'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import StatusBarTime from '@/components/StatusBarTime';

interface FollowUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  is_verified: boolean;
  followers_count: number;
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default function FollowersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const supabase = createClient();

  const defaultTab = (searchParams.get('tab') as 'followers' | 'following') || 'followers';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(defaultTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id, user_profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio, is_verified, followers_count)')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (followersData) {
        const mapped: FollowUser[] = followersData
          .filter((r: any) => r.user_profiles)
          .map((r: any) => r.user_profiles as FollowUser);
        setFollowers(mapped);
      }

      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id, user_profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio, is_verified, followers_count)')
        .eq('follower_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (followingData) {
        const mapped: FollowUser[] = followingData
          .filter((r: any) => r.user_profiles)
          .map((r: any) => r.user_profiles as FollowUser);
        setFollowing(mapped);
        setFollowingIds(new Set(mapped.map((u) => u.id)));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    fetchData();
  }, [user, fetchData]);

  async function toggleFollow(targetId: string) {
    if (!user) return;
    const isFollowing = followingIds.has(targetId);
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
  }

  const list = activeTab === 'followers' ? followers : following;

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
          <div className="px-4 pt-3 pb-0 border-b border-border" style={{ background: 'var(--secondary)' }}>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-bold text-foreground">Connections</h1>
            </div>

            <div className="flex">
              {(['followers', 'following'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm font-semibold capitalize transition-all duration-150"
                  style={{
                    color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  }}
                >
                  {tab === 'followers'
                    ? `Followers${followers.length > 0 ? ` (${followers.length})` : ''}`
                    : `Following${following.length > 0 ? ` (${following.length})` : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'var(--muted)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {list.map((person) => (
                  <div key={person.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => router.push(`/profile/${person.username}`)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div
                        className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-bold"
                        style={{ background: getAvatarColor(person.id) }}
                      >
                        {person.avatar_url ? (
                          <AppImage
                            src={person.avatar_url}
                            alt={`${person.display_name} avatar`}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          person.display_name?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold text-foreground truncate">{person.display_name}</p>
                          {person.is_verified && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)" className="flex-shrink-0">
                              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">@{person.username}</p>
                        {person.bio && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{person.bio}</p>
                        )}
                      </div>
                    </button>

                    {person.id !== user?.id && (
                      <button
                        onClick={() => toggleFollow(person.id)}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={
                          followingIds.has(person.id)
                            ? { background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }
                            : { background: 'var(--primary)', color: 'white' }
                        }
                      >
                        {followingIds.has(person.id) ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <BottomNav activeTab="me" />
        </div>
      </MobileFrame>
    </div>
  );
}
