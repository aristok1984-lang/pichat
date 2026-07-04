'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import StoriesStrip from '@/components/StoriesStrip';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import { SwipeBack } from '@/components/GestureSupport';
import { EmptyChats } from '@/components/EmptyState';

import ChatDetailV2 from './ChatDetailV2';
import GroupChatDetail from './GroupChatDetail';
import CreateGroupModal from './CreateGroupModal';
import StatusBarTime from '@/components/StatusBarTime';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#0E1621';
const HEADER_BG = '#17212B';
const DIVIDER = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED = '#7C8FA3';
const PICHAT_BLUE = '#2AABEE';
const ONLINE_GREEN = '#4CCF7D';

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const DEMO_BOT_ID = '00000000-0000-0000-0000-000000000001';
const SOFIA_ID = 'sofia-reyes-demo-contact-001';

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface ConversationItem {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  otherUserUsername: string;
  otherUserVerified: boolean;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId?: string;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: string;
  avatarColor: string;
}

export interface GroupChatItem {
  id: string;
  groupId: string;
  name: string;
  avatar?: string;
  avatarColor: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isGroup: true;
}

export type ChatListItem = (ConversationItem & { isGroup: false }) | GroupChatItem;

// ── Skeleton row ──────────────────────────────────────────────────────────────
function ConvRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-12 h-12 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded w-1/3" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="h-2.5 rounded w-2/3" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConv, setActiveConv] = useState<ConversationItem | null>(null);
  const [activeGroupChat, setActiveGroupChat] = useState<GroupChatItem | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'dms' | 'groups'>('all');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<any>(null);

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (convErr) throw convErr;

      // Collect other user IDs
      const otherIds = (convData || []).map((c: any) =>
        c.participant_one === user.id ? c.participant_two : c.participant_one
      );

      // Always include demo bot profile
      const allIds = [...new Set([...otherIds, DEMO_BOT_ID])];

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_verified')
        .in('id', allIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const mapped: ConversationItem[] = (convData || []).map((c: any) => {
        const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
        const profile = profileMap.get(otherId);
        const unread = c.participant_one === user.id ? (c.unread_count_one || 0) : (c.unread_count_two || 0);
        return {
          id: c.id,
          otherUserId: otherId,
          otherUserName: profile?.display_name || profile?.username || 'Unknown',
          otherUserAvatar: profile?.avatar_url || undefined,
          otherUserUsername: profile?.username || '',
          otherUserVerified: profile?.is_verified || false,
          lastMessage: c.last_message_text || '',
          lastMessageAt: c.last_message_at || c.created_at,
          lastMessageSenderId: c.last_message_sender_id,
          unreadCount: unread,
          isOnline: otherId === DEMO_BOT_ID ? true : onlineUsers.has(otherId),
          avatarColor: getAvatarColor(otherId),
          isGroup: false as const,
        };
      });

      // Inject demo bot if not already in conversations
      const hasDemoBot = mapped.some(c => c.otherUserId === DEMO_BOT_ID);
      if (!hasDemoBot) {
        const demoBotProfile = profileMap.get(DEMO_BOT_ID);
        if (demoBotProfile) {
          mapped.unshift({
            id: `demo-conv-${user.id}`,
            otherUserId: DEMO_BOT_ID,
            otherUserName: demoBotProfile.display_name || 'PiChat Demo',
            otherUserAvatar: demoBotProfile.avatar_url || undefined,
            otherUserUsername: demoBotProfile.username || 'pichat_demo',
            otherUserVerified: true,
            lastMessage: 'Send me a message to test the chat!',
            lastMessageAt: new Date().toISOString(),
            unreadCount: 0,
            isOnline: true,
            avatarColor: '#2AABEE',
            isGroup: false as const,
          });
        }
      }

      setConversations(mapped);
    } catch (e: any) {
      setError('Failed to load conversations. Tap to retry.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, onlineUsers]);

  // ── Fetch group chats ─────────────────────────────────────────────────────
  const fetchGroupChats = useCallback(async () => {
    if (!user) return;
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setGroupChats([]);
        return;
      }

      const groupIds = memberships.map((m: any) => m.group_id);
      const { data: groups } = await supabase
        .from('group_chats')
        .select('id, name, avatar_url, last_message, last_message_at, members_count')
        .in('id', groupIds)
        .order('last_message_at', { ascending: false });

      if (groups) {
        setGroupChats(groups.map((g: any) => ({
          id: `group-${g.id}`,
          groupId: g.id,
          name: g.name,
          avatar: g.avatar_url || undefined,
          avatarColor: getAvatarColor(g.id),
          lastMessage: g.last_message || '',
          lastMessageAt: g.last_message_at || '',
          unreadCount: 0,
          isGroup: true as const,
        })));
      }
    } catch { /* silent */ }
  }, [user, supabase]);

  // ── Fetch online presence ─────────────────────────────────────────────────
  const fetchPresence = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_presence')
        .select('user_id, is_online, last_seen')
        .eq('is_online', true);
      if (data) {
        setOnlineUsers(new Set(data.map((p: any) => p.user_id)));
      }
    } catch { /* silent */ }
  }, [user, supabase]);

  // ── Update own presence ───────────────────────────────────────────────────
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user) return;
    try {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch { /* silent */ }
  }, [user, supabase]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    fetchPresence().then(() => {
      fetchConversations();
      fetchGroupChats();
    });
    updatePresence(true);

    // Heartbeat presence
    const heartbeat = setInterval(() => updatePresence(true), 30000);

    // Offline on unload
    const handleUnload = () => updatePresence(false);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence(false);
    };
  }, [user]);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`chats_list_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_one=eq.${user.id}`,
      }, () => fetchConversations())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `participant_two=eq.${user.id}`,
      }, () => fetchConversations())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        // Refresh conversation list when any new message arrives (cross-tab sync)
        const row = payload.new as any;
        if (row) {
          // Only refresh if this message belongs to one of our conversations
          setConversations(prev => {
            const affected = prev.find(c => c.id === row.conversation_id);
            if (!affected) return prev;
            // Trigger a full refresh to get updated last_message_text and unread counts
            fetchConversations();
            return prev;
          });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, (payload) => {
        const p = payload.new as any;
        if (p) {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            if (p.is_online) next.add(p.user_id);
            else next.delete(p.user_id);
            return next;
          });
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  // ── Auto-open chat from URL params ────────────────────────────────────────
  useEffect(() => {
    const targetUserId = searchParams?.get('userId');
    if (!targetUserId || !user) return;

    async function openOrCreateConversation() {
      try {
        const { data: convId } = await supabase.rpc('get_or_create_conversation', {
          other_user_id: targetUserId,
        });

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url, is_verified')
          .eq('id', targetUserId)
          .single();

        if (convId && profile) {
          setActiveConv({
            id: convId,
            otherUserId: profile.id,
            otherUserName: profile.display_name || profile.username,
            otherUserAvatar: profile.avatar_url || undefined,
            otherUserUsername: profile.username,
            otherUserVerified: profile.is_verified || false,
            lastMessage: '',
            lastMessageAt: '',
            unreadCount: 0,
            isOnline: onlineUsers.has(profile.id),
            avatarColor: getAvatarColor(profile.id),
            isGroup: false,
          });
        }
      } catch { /* silent */ }
    }
    openOrCreateConversation();
  }, [searchParams, user]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      !q || c.otherUserName.toLowerCase().includes(q) ||
      c.otherUserUsername.toLowerCase().includes(q) ||
      c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return groupChats.filter(g =>
      !q || g.name.toLowerCase().includes(q) || g.lastMessage.toLowerCase().includes(q)
    );
  }, [groupChats, searchQuery]);

  const allItems = useMemo(() => {
    if (activeTab === 'dms') return filteredConversations;
    if (activeTab === 'groups') return filteredGroups;
    return [...filteredConversations, ...filteredGroups].sort((a, b) =>
      new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );
  }, [activeTab, filteredConversations, filteredGroups]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  function handleGroupCreated(groupId: string, groupName: string, avatarColor: string) {
    setShowCreateGroup(false);
    fetchGroupChats();
    setActiveGroupChat({
      id: `group-${groupId}`,
      groupId,
      name: groupName,
      avatar: undefined,
      avatarColor,
      lastMessage: '',
      lastMessageAt: '',
      unreadCount: 0,
      isGroup: true,
    });
  }

  // ── Open or create conversation with any real user ────────────────────────
  const openConversation = useCallback(async (conv: ConversationItem) => {
    if (!user) return;

    // If it's already a real DB conversation (UUID format), open directly
    if (!conv.id.startsWith('demo-conv-')) {
      setActiveConv(conv);
      return;
    }

    // Need to create/find a real conversation in Supabase
    try {
      const { data: convId, error: rpcErr } = await supabase.rpc('get_or_create_conversation', {
        other_user_id: conv.otherUserId,
      });

      if (rpcErr) throw rpcErr;

      if (convId) {
        setActiveConv({ ...conv, id: convId });
        // Refresh list to show the new conversation
        fetchConversations();
      }
    } catch {
      // Fallback: open with placeholder id
      setActiveConv(conv);
    }
  }, [user, supabase, fetchConversations]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      {showCreateGroup && user && (
        <CreateGroupModal
          currentUserId={user.id}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

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
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 rounded-sm border border-foreground relative">
                <div className="absolute inset-0.5 right-1 rounded-sm" style={{ background: 'var(--online)' }} />
                <div className="absolute -right-0.5 top-0.5 w-0.5 h-1.5 rounded-r-sm" style={{ background: 'var(--foreground)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Active DM */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <SwipeBack onBack={() => { setActiveConv(null); fetchConversations(); }}>
              <ChatDetailV2
                conversation={activeConv}
                currentUserId={user?.id || ''}
                onBack={() => { setActiveConv(null); fetchConversations(); }}
              />
            </SwipeBack>
          </div>
        ) : activeGroupChat ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <SwipeBack onBack={() => { setActiveGroupChat(null); fetchGroupChats(); }}>
              <GroupChatDetail
                groupId={activeGroupChat.groupId}
                groupName={activeGroupChat.name}
                avatarColor={activeGroupChat.avatarColor}
                currentUserId={user?.id || ''}
                onBack={() => { setActiveGroupChat(null); fetchGroupChats(); }}
              />
            </SwipeBack>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden page-enter">
            {/* Header */}
            <div className="messenger-header px-4 pt-3 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-[22px] font-bold text-foreground tracking-tight leading-none">Chats</h1>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="header-icon-btn"
                    title="New group"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                      <line x1="20" y1="8" x2="20" y2="14" /><line x1="17" y1="11" x2="23" y2="11" />
                    </svg>
                  </button>
                  <button onClick={() => router.push('/notifications')} className="header-icon-btn" title="Notifications">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search conversations…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-bar-dark"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--muted-foreground)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {(['all', 'dms', 'groups'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all capitalize"
                    style={{
                      background: activeTab === tab ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                      color: activeTab === tab ? 'white' : 'var(--muted-foreground)',
                    }}>
                    {tab === 'all' ? 'All' : tab === 'dms' ? 'Direct' : 'Groups'}
                  </button>
                ))}
              </div>
            </div>

            {/* Stories */}
            <div style={{ background: 'var(--secondary)', borderBottom: `1px solid ${DIVIDER}` }}>
              <StoriesStrip />
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col pt-2">
                  {Array.from({ length: 7 }).map((_, i) => <ConvRowSkeleton key={i} />)}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
                  <p className="text-sm" style={{ color: TEXT_MUTED }}>{error}</p>
                  <button onClick={() => { fetchConversations(); fetchGroupChats(); }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: PICHAT_BLUE }}>
                    Retry
                  </button>
                </div>
              ) : allItems.length === 0 ? (
                searchQuery ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 px-6 text-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <p className="text-sm font-semibold text-foreground">No results</p>
                    <p className="text-xs" style={{ color: TEXT_MUTED }}>No conversations match &quot;{searchQuery}&quot;</p>
                  </div>
                ) : (
                  <EmptyChats />
                )
              ) : (
                <div className="flex flex-col">
                  {allItems.map(item => {
                    const isGroup = item.isGroup;
                    const conv = isGroup ? null : item as ConversationItem;
                    const grp = isGroup ? item as GroupChatItem : null;
                    const name = isGroup ? grp!.name : conv!.otherUserName;
                    const avatar = isGroup ? grp!.avatar : conv!.otherUserAvatar;
                    const avatarColor = item.avatarColor;
                    const lastMsg = item.lastMessage;
                    const lastTime = item.lastMessageAt;
                    const unread = item.unreadCount;
                    const isOnline = !isGroup && (conv!.isOnline || onlineUsers.has(conv!.otherUserId));

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (isGroup) setActiveGroupChat(grp!);
                          else openConversation(conv as ConversationItem);
                        }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-all text-left"
                        style={{ borderBottom: `1px solid rgba(42,58,74,0.3)` }}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-lg"
                            style={{ background: avatarColor }}>
                            {avatar ? (
                              <AppImage src={avatar} alt={name} width={48} height={48} className="w-full h-full object-cover" />
                            ) : (
                              <span>{name?.charAt(0)?.toUpperCase()}</span>
                            )}
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2"
                              style={{ background: ONLINE_GREEN, borderColor: BG }} />
                          )}
                          {isGroup && (
                            <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: PICHAT_BLUE, border: `2px solid ${BG}` }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                              </svg>
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-sm font-bold text-foreground truncate">{name}</span>
                              {!isGroup && conv!.otherUserVerified && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={PICHAT_BLUE} className="shrink-0">
                                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                                </svg>
                              )}
                            </div>
                            <span className="text-[11px] shrink-0 ml-2" style={{ color: TEXT_MUTED }}>
                              {timeAgo(lastTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs truncate max-w-[200px]"
                              style={{ color: unread > 0 ? TEXT_PRIMARY : TEXT_MUTED, fontWeight: unread > 0 ? 500 : 400 }}>
                              {lastMsg || 'Start a conversation'}
                            </p>
                            {unread > 0 && (
                              <span className="ml-2 shrink-0 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
                                style={{ background: PICHAT_BLUE }}>
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Floating compose */}
            <button
              onClick={() => router.push('/search')}
              className="floating-btn gradient-primary-btn floating-btn-pulse"
              title="New message"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>

            <BottomNav activeTab="chats" />
          </div>
        )}
      </MobileFrame>
    </div>
  );
}
const ChatItem: React.FC = () => {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn('Placeholder: ChatItem is not implemented yet.');
  }, []);
  return (
    <div>
      {/* ChatItem placeholder */}
    </div>
  );
};

export { ChatItem };