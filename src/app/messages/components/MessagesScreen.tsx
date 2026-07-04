'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import AppImage from '@/components/ui/AppImage';
import MediaUpload, { MediaPreview, MediaBubble, UploadedMedia } from '@/components/MediaUpload';
import StatusBarTime from '@/components/StatusBarTime';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  media_url: string;
  is_read: boolean;
  created_at: string;
  reply_to_id?: string;
}

interface Conversation {
  user: UserProfile;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isOnline: boolean;
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Conversation List ────────────────────────────────────────────────────────
function ConversationList({
  conversations,
  onSelect,
}: {
  conversations: Conversation[];
  onSelect: (user: UserProfile) => void;
  currentUserId: string;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.15)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" opacity="0.7">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">No messages yet</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Start a conversation to connect</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conv) => (
        <button
          key={conv.user.id}
          onClick={() => onSelect(conv.user)}
          className="conv-row text-left w-full"
        >
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden" style={{ background: getAvatarColor(conv.user.id) }}>
              {conv.user.avatar_url ? (
                <AppImage src={conv.user.avatar_url} alt={conv.user.display_name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                  {conv.user.display_name?.charAt(0) || '?'}
                </div>
              )}
            </div>
            {conv.isOnline && (
              <span
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                style={{ background: 'var(--online)', borderColor: 'var(--background)', boxShadow: '0 0 6px rgba(76,207,125,0.6)' }}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{conv.user.display_name}</span>
                {conv.user.is_verified && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                  </svg>
                )}
              </div>
              <span className="text-[11px] font-tabular shrink-0" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(conv.lastMessageAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs truncate max-w-[180px]" style={{ color: conv.unreadCount > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', fontWeight: conv.unreadCount > 0 ? 500 : 400 }}>
                {conv.lastMessage}
              </span>
              {conv.unreadCount > 0 && (
                <span className="unread-badge shrink-0 ml-2 badge-pop">{conv.unreadCount}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── DM Chat View ─────────────────────────────────────────────────────────────
function DMChatView({
  otherUser,
  currentUserId,
  onBack,
}: {
  otherUser: UserProfile;
  currentUserId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as DirectMessage[]);
    setLoading(false);

    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('sender_id', otherUser.id)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);
  }, [currentUserId, otherUser.id]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`dm_${currentUserId}_${otherUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, (payload) => {
        if (payload.new.sender_id === otherUser.id) {
          setMessages(prev => [...prev, payload.new as DirectMessage]);
          setIsTyping(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages, currentUserId, otherUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text && !selectedMedia) return;
    setInputText('');
    const mediaToSend = selectedMedia;
    setSelectedMedia(null);

    const msgType = mediaToSend ? mediaToSend.type : 'text';

    const optimistic: DirectMessage = {
      id: `opt-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content: text,
      message_type: msgType,
      media_url: mediaToSend?.url || '',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    await supabase.from('direct_messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUser.id,
      content: text,
      message_type: msgType,
      media_url: mediaToSend?.url || '',
      media_type: mediaToSend?.type || '',
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      {/* ── Header ── */}
      <div className="messenger-header flex items-center gap-3 px-3 py-2.5">
        <button onClick={onBack} className="header-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <button className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden" style={{ background: getAvatarColor(otherUser.id) }}>
              {otherUser.avatar_url ? (
                <AppImage src={otherUser.avatar_url} alt={otherUser.display_name} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {otherUser.display_name?.charAt(0)}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground truncate leading-tight">{otherUser.display_name}</p>
              {otherUser.is_verified && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--primary)" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>@{otherUser.username}</p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button className="header-icon-btn">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012 .01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
            </svg>
          </button>
          <button className="header-icon-btn">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="19" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        <div className="date-divider">
          <span>Today</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex items-end gap-2 msg-enter ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isSelf && (
                  <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden" style={{ background: getAvatarColor(otherUser.id) }}>
                    {otherUser.avatar_url ? (
                      <AppImage src={otherUser.avatar_url} alt={otherUser.display_name} width={28} height={28} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                        {otherUser.display_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[72%] px-3 py-2 ${isSelf ? 'message-bubble-out' : 'message-bubble-in'}`}>
                  {msg.media_url ? (
                    <MediaBubble mediaUrl={msg.media_url} mediaType={msg.message_type} content={msg.content} />
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: isSelf ? 'white' : 'var(--foreground)' }}>{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1 ${isSelf ? 'text-right' : 'text-left'}`} style={{ color: isSelf ? 'rgba(255,255,255,0.55)' : 'var(--muted-foreground)' }}>
                    {formatTime(msg.created_at)}
                    {isSelf && <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {isTyping && (
          <div className="flex items-end gap-2 msg-enter">
            <div className="w-7 h-7 rounded-full shrink-0" style={{ background: getAvatarColor(otherUser.id) }} />
            <div className="message-bubble-in px-4 py-3 flex items-center gap-1">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <div className="messenger-input-bar flex flex-col px-3 py-3 gap-2">
        {selectedMedia && (
          <MediaPreview media={selectedMedia} onRemove={() => setSelectedMedia(null)} />
        )}
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1 pb-0.5">
            <MediaUpload
              onMediaSelected={setSelectedMedia}
              selectedMedia={selectedMedia}
              userId={currentUserId}
            />
          </div>
          <div className="flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message…"
              rows={1}
              className="messenger-input-field"
            />
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            <button className="messenger-action-btn">
              <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() && !selectedMedia}
              className="messenger-send-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Messages Screen ─────────────────────────────────────────────────────
export default function MessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'dms' | 'groups'>('dms');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (!user) { router.push('/sign-up-login-screen'); return; }
    fetchConversations();

    // Real-time: refresh inbox on new incoming/outgoing messages and read receipts
    const supabaseClient = createClient();
    const channel = supabaseClient
      .channel('messages_inbox_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => { fetchConversations(); })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `sender_id=eq.${user.id}`,
      }, () => { fetchConversations(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => { fetchConversations(); })
      .subscribe();

    return () => { supabaseClient.removeChannel(channel); };
  }, [user]);

  async function fetchConversations() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: dms } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!dms) { setLoading(false); return; }

      const convMap = new Map<string, { lastMsg: DirectMessage; unread: number }>();
      dms.forEach((msg: DirectMessage) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!convMap.has(otherId)) {
          convMap.set(otherId, { lastMsg: msg, unread: 0 });
        }
        if (msg.receiver_id === user.id && !msg.is_read) {
          const existing = convMap.get(otherId)!;
          convMap.set(otherId, { ...existing, unread: existing.unread + 1 });
        }
      });

      const otherIds = Array.from(convMap.keys());
      if (otherIds.length === 0) { setLoading(false); return; }

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, is_verified')
        .in('id', otherIds);

      if (profiles) {
        const convList: Conversation[] = profiles.map((p: UserProfile) => {
          const conv = convMap.get(p.id)!;
          return {
            user: p,
            lastMessage: conv.lastMsg.content,
            lastMessageAt: conv.lastMsg.created_at,
            unreadCount: conv.unread,
            isOnline: Math.random() > 0.5,
          };
        });
        convList.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        setConversations(convList);
      }
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const filtered = conversations.filter(c =>
    c.user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedUser && user) {
    return (
      <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
        <MobileFrame>
          <div className="status-bar">
            <StatusBarTime />
          </div>
          <DMChatView
            otherUser={selectedUser}
            currentUserId={user.id}
            onBack={() => { setSelectedUser(null); fetchConversations(); }}
          />
        </MobileFrame>
      </div>
    );
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
          {/* ── Header ── */}
          <div className="messenger-header px-4 pt-3 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-[22px] font-bold text-foreground tracking-tight leading-none">Messages</h1>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {conversations.filter(c => c.unreadCount > 0).length > 0
                    ? `${conversations.filter(c => c.unreadCount > 0).length} unread`
                    : 'All caught up'}
                </p>
              </div>
              <button
                onClick={() => router.push('/search')}
                className="header-icon-btn"
                title="New conversation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              {(['dms', 'groups'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveView(tab)}
                  className={`tab-pill ${activeView === tab ? 'tab-pill-active' : 'tab-pill-inactive'}`}
                >
                  {tab === 'dms' ? 'Direct' : 'Groups'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--muted-foreground)' }}
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search messages…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-bar-dark"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeView === 'dms' ? (
              loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <ConversationList
                  conversations={filtered}
                  onSelect={setSelectedUser}
                  currentUserId={user?.id || ''}
                />
              )
            ) : (
              <GroupChatsList userId={user?.id || ''} />
            )}
          </div>

          <BottomNav activeTab="chats" />
        </div>
      </MobileFrame>
    </div>
  );
}

// ─── Group Chats List ─────────────────────────────────────────────────────────
function GroupChatsList({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!userId) return;
    async function fetchGroups() {
      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (!memberRows || memberRows.length === 0) { setLoading(false); return; }

      const groupIds = memberRows.map((r: any) => r.group_id);
      const { data } = await supabase
        .from('group_chats')
        .select('*')
        .in('id', groupIds)
        .order('last_message_at', { ascending: false });

      if (data) setGroups(data);
      setLoading(false);
    }
    fetchGroups();
  }, [userId]);

  if (selectedGroup) {
    return <GroupChatView group={selectedGroup} userId={userId} onBack={() => setSelectedGroup(null)} />;
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.8">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">No group chats yet</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Create or join a group to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => setSelectedGroup(group)}
          className="conv-row text-left w-full"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-lg"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
            {group.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm font-semibold text-foreground truncate">{group.name}</span>
              <span className="text-[11px] font-tabular shrink-0" style={{ color: 'var(--muted-foreground)' }}>{timeAgo(group.last_message_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--muted-foreground)' }}>{group.last_message || 'No messages yet'}</span>
              <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{group.members_count} members</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Group Chat View ──────────────────────────────────────────────────────────
function GroupChatView({ group, userId, onBack }: { group: any; userId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchMessages() {
      const { data } = await supabase
        .from('group_messages')
        .select('*, user_profiles(username, display_name, avatar_url)')
        .eq('group_id', group.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      setLoading(false);
    }
    fetchMessages();

    const channel = supabase
      .channel(`group_${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` },
        async (payload) => {
          const { data } = await supabase
            .from('group_messages')
            .select('*, user_profiles(username, display_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();
          if (data) setMessages(prev => [...prev, data]);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = inputText.trim();
    if (!text && !selectedMedia) return;
    setInputText('');
    const mediaToSend = selectedMedia;
    setSelectedMedia(null);

    const msgType = mediaToSend ? mediaToSend.type : 'text';
    await supabase.from('group_messages').insert({
      group_id: group.id,
      sender_id: userId,
      content: text,
      message_type: msgType,
      media_url: mediaToSend?.url || '',
      media_type: mediaToSend?.type || '',
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
      {/* ── Header ── */}
      <div className="messenger-header flex items-center gap-3 px-3 py-2.5">
        <button onClick={onBack} className="header-icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
          {group.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate leading-tight">{group.name}</p>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{group.members_count} members</p>
        </div>
        <button className="header-icon-btn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        <div className="date-divider"><span>Today</span></div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.sender_id === userId;
            const profile = msg.user_profiles;
            return (
              <div key={msg.id} className={`flex items-end gap-2 msg-enter ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isSelf && (
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: getAvatarColor(msg.sender_id) }}>
                    {profile?.display_name?.charAt(0) || '?'}
                  </div>
                )}
                <div className="max-w-[72%]">
                  {!isSelf && <p className="text-[10px] mb-1 ml-1" style={{ color: 'var(--muted-foreground)' }}>{profile?.display_name}</p>}
                  <div className={`px-3 py-2 ${isSelf ? 'message-bubble-out' : 'message-bubble-in'}`}>
                    {msg.media_url ? (
                      <MediaBubble mediaUrl={msg.media_url} mediaType={msg.message_type} content={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed" style={{ color: isSelf ? 'white' : 'var(--foreground)' }}>{msg.content}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${isSelf ? 'text-right' : 'text-left'}`} style={{ color: isSelf ? 'rgba(255,255,255,0.55)' : 'var(--muted-foreground)' }}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <div className="messenger-input-bar flex flex-col px-3 py-3 gap-2">
        {selectedMedia && (
          <MediaPreview media={selectedMedia} onRemove={() => setSelectedMedia(null)} />
        )}
        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1 pb-0.5">
            <MediaUpload
              onMediaSelected={setSelectedMedia}
              selectedMedia={selectedMedia}
              userId={userId}
            />
          </div>
          <div className="flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message group…"
              rows={1}
              className="messenger-input-field"
            />
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            <button className="messenger-action-btn">
              <svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() && !selectedMedia}
              className="messenger-send-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
