'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  banner_url: string;
  members_count: number;
  posts_count: number;
  is_private: boolean;
  created_at: string;
  owner_id: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  community_id: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
}

const COMMUNITY_COLORS = ['#2A97DF', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
function getColor(name: string) {
  return COMMUNITY_COLORS[(name?.charCodeAt(0) || 0) % COMMUNITY_COLORS.length];
}
function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
}

type DrawerType = 'members' | 'channels' | null;

export default function MyCommunitiesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<Community | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  // Drawer state
  const [drawerType, setDrawerType] = useState<DrawerType>(null);
  const [drawerCommunity, setDrawerCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Channel creation
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'announcement'>('text');
  const [creatingChannel, setCreatingChannel] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-up-login-screen');
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) fetchMyCommunities();
  }, [user]);

  async function fetchMyCommunities() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('communities')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      setCommunities(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleDelete(community: Community) {
    setDeleting(true);
    try {
      await supabase.from('community_members').delete().eq('community_id', community.id);
      await supabase.from('communities').delete().eq('id', community.id);
      setCommunities(prev => prev.filter(c => c.id !== community.id));
      setDeleteConfirm(null);
      showToast(`"${community.name}" deleted`);
    } catch {
      showToast('Failed to delete community');
    } finally {
      setDeleting(false);
    }
  }

  async function openDrawer(type: DrawerType, community: Community) {
    setDrawerType(type);
    setDrawerCommunity(community);
    setDrawerLoading(true);
    setMembers([]);
    setChannels([]);
    setNewChannelName('');

    try {
      if (type === 'members') {
        const { data } = await supabase
          .from('community_members')
          .select('id, user_id, role, joined_at, user_profiles:user_id(username, display_name, avatar_url)')
          .eq('community_id', community.id)
          .order('joined_at', { ascending: true });
        setMembers((data || []) as Member[]);
      } else if (type === 'channels') {
        const { data } = await supabase
          .from('community_channels')
          .select('id, name, type, community_id')
          .eq('community_id', community.id)
          .order('created_at', { ascending: true });
        setChannels(data || []);
      }
    } catch {
      // silent
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setDrawerType(null);
    setDrawerCommunity(null);
    setMembers([]);
    setChannels([]);
    setNewChannelName('');
  }

  async function handleRemoveMember(memberId: string, username: string) {
    try {
      await supabase.from('community_members').delete().eq('id', memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      showToast(`${username} removed`);
    } catch {
      showToast('Failed to remove member');
    }
  }

  async function handleChangeMemberRole(memberId: string, newRole: string) {
    try {
      await supabase.from('community_members').update({ role: newRole }).eq('id', memberId);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      showToast('Role updated');
    } catch {
      showToast('Failed to update role');
    }
  }

  async function handleCreateChannel() {
    if (!newChannelName.trim() || !drawerCommunity) return;
    setCreatingChannel(true);
    try {
      const slug = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data, error } = await supabase
        .from('community_channels')
        .insert({
          community_id: drawerCommunity.id,
          name: newChannelName.trim(),
          slug,
          type: newChannelType,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (data) setChannels(prev => [...prev, data]);
      setNewChannelName('');
      showToast(`#${newChannelName.trim()} created`);
    } catch {
      showToast('Failed to create channel');
    } finally {
      setCreatingChannel(false);
    }
  }

  async function handleDeleteChannel(channelId: string, channelName: string) {
    try {
      await supabase.from('community_channels').delete().eq('id', channelId);
      setChannels(prev => prev.filter(c => c.id !== channelId));
      showToast(`#${channelName} deleted`);
    } catch {
      showToast('Failed to delete channel');
    }
  }

  if (authLoading) {
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

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
        </div>

        <div className="flex flex-col h-full overflow-hidden relative">
          {/* Header */}
          <div
            className="px-4 pt-3 pb-3 shrink-0 flex items-center gap-3"
            style={{ background: 'var(--secondary)', borderBottom: '0.7px solid var(--border)' }}
          >
            <button
              onClick={() => router.push('/communities')}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-foreground" style={{ fontSize: '16px' }}>My Communities</h1>
              <p className="text-muted-foreground" style={{ fontSize: '11px' }}>
                {communities.length} {communities.length === 1 ? 'community' : 'communities'} owned
              </p>
            </div>
            <button
              onClick={() => router.push('/communities/create')}
              className="flex items-center gap-1 px-3 py-1.5 font-semibold"
              style={{ background: 'var(--primary)', color: 'white', fontSize: '12px', borderRadius: '2px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto pb-20">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : communities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
                <div
                  className="w-14 h-14 flex items-center justify-center mb-4"
                  style={{ background: 'var(--muted)', borderRadius: '2px' }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="font-bold text-foreground mb-1" style={{ fontSize: '15px' }}>No communities yet</p>
                <p className="text-muted-foreground mb-4" style={{ fontSize: '13px' }}>Create your first community to get started</p>
                <button
                  onClick={() => router.push('/communities/create')}
                  className="px-5 py-2 font-semibold"
                  style={{ background: 'var(--primary)', color: 'white', fontSize: '13px', borderRadius: '2px' }}
                >
                  Create Community
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {communities.map((community) => {
                  const color = getColor(community.name);
                  return (
                    <div
                      key={community.id}
                      style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px' }}
                    >
                      {/* Community header row */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => router.push(`/communities/${community.slug}`)}
                      >
                        {community.avatar_url ? (
                          <img
                            src={community.avatar_url}
                            alt={`${community.name} avatar`}
                            className="w-11 h-11 object-cover shrink-0"
                            style={{ borderRadius: '2px' }}
                          />
                        ) : (
                          <div
                            className="w-11 h-11 flex items-center justify-center font-bold text-white shrink-0"
                            style={{ background: color, borderRadius: '2px', fontSize: '16px' }}
                          >
                            {community.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-bold text-foreground truncate" style={{ fontSize: '14px' }}>{community.name}</span>
                            {community.is_private && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground" style={{ fontSize: '11px' }}>
                              {formatCount(community.members_count)} members
                            </span>
                            <span className="text-muted-foreground" style={{ fontSize: '11px' }}>·</span>
                            <span className="text-muted-foreground" style={{ fontSize: '11px' }}>
                              {formatCount(community.posts_count)} posts
                            </span>
                          </div>
                        </div>
                        <div
                          className="px-2 py-0.5 font-semibold shrink-0"
                          style={{ background: 'rgba(42,151,223,0.12)', color: '#2A97DF', fontSize: '10px', borderRadius: '2px' }}
                        >
                          Owner
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-0"
                        style={{ borderTop: '0.7px solid var(--border)' }}
                      >
                        {/* Edit Settings */}
                        <button
                          onClick={() => router.push(`/communities/${community.slug}/edit`)}
                          className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all"
                          style={{ borderRight: '0.7px solid var(--border)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span className="text-muted-foreground font-medium" style={{ fontSize: '10px' }}>Settings</span>
                        </button>

                        {/* Members */}
                        <button
                          onClick={() => openDrawer('members', community)}
                          className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all"
                          style={{ borderRight: '0.7px solid var(--border)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                          </svg>
                          <span className="text-muted-foreground font-medium" style={{ fontSize: '10px' }}>Members</span>
                        </button>

                        {/* Channels */}
                        <button
                          onClick={() => openDrawer('channels', community)}
                          className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all"
                          style={{ borderRight: '0.7px solid var(--border)' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.8">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          <span className="text-muted-foreground font-medium" style={{ fontSize: '10px' }}>Channels</span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirm(community)}
                          className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                          </svg>
                          <span className="font-medium" style={{ color: '#EF4444', fontSize: '10px' }}>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Nav */}
          <BottomNav activeTab="contacts" />

          {/* Delete Confirm Modal */}
          {deleteConfirm && (
            <div
              className="absolute inset-0 flex items-end justify-center z-50"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => !deleting && setDeleteConfirm(null)}
            >
              <div
                className="w-full p-5"
                style={{ background: 'var(--card)', borderRadius: '2px 2px 0 0', borderTop: '0.7px solid var(--border)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="w-8 h-1 mx-auto mb-4"
                  style={{ background: 'var(--border)', borderRadius: '2px' }}
                />
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '2px' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-foreground" style={{ fontSize: '15px' }}>Delete Community</p>
                    <p className="text-muted-foreground" style={{ fontSize: '12px' }}>This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-muted-foreground mb-4" style={{ fontSize: '13px' }}>
                  Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirm.name}"</span>? All members will be removed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    disabled={deleting}
                    className="flex-1 py-2.5 font-semibold"
                    style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '13px', borderRadius: '2px' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    disabled={deleting}
                    className="flex-1 py-2.5 font-semibold flex items-center justify-center gap-2"
                    style={{ background: '#EF4444', color: 'white', fontSize: '13px', borderRadius: '2px' }}
                  >
                    {deleting ? (
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                        <path d="M21 12a9 9 0 00-9-9" />
                      </svg>
                    ) : null}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Members / Channels Drawer */}
          {drawerType && drawerCommunity && (
            <div
              className="absolute inset-0 flex flex-col justify-end z-50"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              onClick={closeDrawer}
            >
              <div
                className="w-full flex flex-col"
                style={{ background: 'var(--card)', borderRadius: '2px 2px 0 0', maxHeight: '80%', borderTop: '0.7px solid var(--border)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer handle + header */}
                <div className="px-4 pt-3 pb-3 shrink-0" style={{ borderBottom: '0.7px solid var(--border)' }}>
                  <div className="w-8 h-1 mx-auto mb-3" style={{ background: 'var(--border)', borderRadius: '2px' }} />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground" style={{ fontSize: '15px' }}>
                        {drawerType === 'members' ? 'Members' : 'Channels'}
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: '11px' }}>{drawerCommunity.name}</p>
                    </div>
                    <button onClick={closeDrawer} className="w-7 h-7 flex items-center justify-center text-muted-foreground">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Drawer content */}
                <div className="flex-1 overflow-y-auto">
                  {drawerLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                        <path d="M21 12a9 9 0 00-9-9" />
                      </svg>
                    </div>
                  ) : drawerType === 'members' ? (
                    <div>
                      {members.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8" style={{ fontSize: '13px' }}>No members yet</p>
                      ) : (
                        members.map((member) => {
                          const profile = member.user_profiles;
                          const isOwnerMember = member.user_id === drawerCommunity.owner_id;
                          return (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 px-4 py-3"
                              style={{ borderBottom: '0.7px solid var(--border)' }}
                            >
                              <div
                                className="w-9 h-9 flex items-center justify-center font-bold text-white shrink-0"
                                style={{ background: getColor(profile?.username || 'U'), borderRadius: '2px', fontSize: '13px' }}
                              >
                                {profile?.avatar_url ? (
                                  <img src={profile.avatar_url} alt={profile.display_name || profile.username || 'Member'} className="w-full h-full object-cover" style={{ borderRadius: '2px' }} />
                                ) : (
                                  (profile?.display_name || profile?.username || 'U').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground truncate" style={{ fontSize: '13px' }}>
                                  {profile?.display_name || profile?.username || 'Unknown'}
                                </p>
                                <p className="text-muted-foreground truncate" style={{ fontSize: '11px' }}>@{profile?.username || '—'}</p>
                              </div>
                              {isOwnerMember ? (
                                <span
                                  className="px-2 py-0.5 font-semibold shrink-0"
                                  style={{ background: 'rgba(42,151,223,0.12)', color: '#2A97DF', fontSize: '10px', borderRadius: '2px' }}
                                >
                                  Owner
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <select
                                    value={member.role}
                                    onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                                    className="outline-none font-medium"
                                    style={{ background: 'var(--muted)', color: 'var(--foreground)', fontSize: '10px', borderRadius: '2px', padding: '2px 4px', border: '0.7px solid var(--border)' }}
                                  >
                                    <option value="member">Member</option>
                                    <option value="moderator">Mod</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <button
                                    onClick={() => handleRemoveMember(member.id, profile?.username || 'member')}
                                    className="w-6 h-6 flex items-center justify-center"
                                    style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '2px' }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* Create channel form */}
                      <div className="px-4 py-3" style={{ borderBottom: '0.7px solid var(--border)' }}>
                        <p className="font-semibold text-foreground mb-2" style={{ fontSize: '12px' }}>Create Channel</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="channel-name"
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                            className="flex-1 px-3 py-2 outline-none"
                            style={{ background: 'var(--muted)', color: 'var(--foreground)', fontSize: '12px', borderRadius: '2px', border: '0.7px solid var(--border)' }}
                          />
                          <select
                            value={newChannelType}
                            onChange={(e) => setNewChannelType(e.target.value as 'text' | 'announcement')}
                            className="outline-none"
                            style={{ background: 'var(--muted)', color: 'var(--foreground)', fontSize: '11px', borderRadius: '2px', border: '0.7px solid var(--border)', padding: '0 6px' }}
                          >
                            <option value="text">Text</option>
                            <option value="announcement">Announce</option>
                          </select>
                          <button
                            onClick={handleCreateChannel}
                            disabled={!newChannelName.trim() || creatingChannel}
                            className="px-3 py-2 font-semibold flex items-center gap-1"
                            style={{
                              background: newChannelName.trim() ? 'var(--primary)' : 'var(--muted)',
                              color: newChannelName.trim() ? 'white' : 'var(--muted-foreground)',
                              fontSize: '12px',
                              borderRadius: '2px',
                            }}
                          >
                            {creatingChannel ? (
                              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                                <path d="M21 12a9 9 0 00-9-9" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            )}
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Channel list */}
                      {channels.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8" style={{ fontSize: '13px' }}>No channels yet</p>
                      ) : (
                        channels.map((channel) => (
                          <div
                            key={channel.id}
                            className="flex items-center gap-3 px-4 py-3"
                            style={{ borderBottom: '0.7px solid var(--border)' }}
                          >
                            <div
                              className="w-7 h-7 flex items-center justify-center shrink-0"
                              style={{ background: 'var(--muted)', borderRadius: '2px' }}
                            >
                              <span className="font-bold text-muted-foreground" style={{ fontSize: '13px' }}>#</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground truncate" style={{ fontSize: '13px' }}>{channel.name}</p>
                              <p className="text-muted-foreground capitalize" style={{ fontSize: '10px' }}>{channel.type}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteChannel(channel.id, channel.name)}
                              className="w-6 h-6 flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '2px' }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div
              className="absolute bottom-24 left-4 right-4 py-2.5 px-4 font-medium text-center z-50"
              style={{ background: 'var(--card)', border: '0.7px solid var(--border)', borderRadius: '2px', fontSize: '13px', color: 'var(--foreground)' }}
            >
              {toast}
            </div>
          )}
        </div>
      </MobileFrame>
    </div>
  );
}
