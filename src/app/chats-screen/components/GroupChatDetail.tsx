'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';
import EmojiReactionPicker from './EmojiReactionPicker';

const BG = '#0E1621';
const HEADER_BG = '#17212B';
const INCOMING_BG = '#242F3D';
const INCOMING_BORDER = 'rgba(42,58,74,0.80)';
const OUTGOING_BG = '#1A8FCC';
const OUTGOING_BORDER = 'rgba(42,171,238,0.55)';
const COMPOSER_BG = '#17212B';
const COMPOSER_BORDER = 'rgba(42,58,74,0.80)';
const DATE_SEP_BG = 'rgba(23,33,43,0.85)';
const DATE_SEP_BORDER = 'rgba(42,58,74,0.60)';
const DIVIDER = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY = '#E8EDF2';
const TEXT_MUTED = '#7C8FA3';
const PRIMARY = '#2AABEE';
const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

const DOT_BG_STYLE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(190,230,255,0.035) 0.5px, transparent 0.5px)',
  backgroundSize: '7px 7px',
  backgroundRepeat: 'repeat',
};

function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface GroupMessage {
  id: string;
  text: string;
  time: string;
  isSelf: boolean;
  senderName: string;
  senderAvatar?: string;
  senderId: string;
  reactions?: Record<string, string[]>;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  user_profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface GroupChatDetailProps {
  groupId: string;
  groupName: string;
  avatarColor: string;
  currentUserId: string;
  onBack: () => void;
}

// Members Drawer
function MembersDrawer({
  members,
  currentUserId,
  isAdmin,
  onClose,
  onRemoveMember,
}: {
  members: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onRemoveMember: (userId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden flex flex-col"
        style={{ background: BG, border: `1px solid ${DIVIDER}`, maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: HEADER_BG, borderBottom: `1px solid ${DIVIDER}` }}>
          <h3 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>
            Members ({members.length})
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: TEXT_MUTED }}>Done</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {members.map(m => {
            const profile = m.user_profiles;
            const name = profile?.display_name || profile?.username || 'Unknown';
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
                  style={{ background: getAvatarColor(m.user_id) }}>
                  {profile?.avatar_url ? (
                    <AppImage src={profile.avatar_url} alt={name} width={40} height={40} className="w-full h-full object-cover" />
                  ) : <span>{name.charAt(0)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{name}</p>
                  <p className="text-xs" style={{ color: m.role === 'admin' ? PRIMARY : TEXT_MUTED }}>
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                  </p>
                </div>
                {isAdmin && m.user_id !== currentUserId && (
                  <button onClick={() => onRemoveMember(m.user_id)}
                    className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Group Message Bubble with emoji reactions
function GroupMessageBubble({
  msg,
  showSenderName,
  currentUserId,
  onReaction,
}: {
  msg: GroupMessage;
  showSenderName: boolean;
  currentUserId: string;
  onReaction: (msgId: string, emoji: string) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reactionEntries = Object.entries(msg.reactions || {}).filter(([, users]) => users.length > 0);

  return (
    <div className={`flex items-end gap-2 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
      {!msg.isSelf && (
        <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0 mb-0.5"
          style={{ background: getAvatarColor(msg.senderId), opacity: showSenderName ? 1 : 0 }}>
          {msg.senderAvatar ? (
            <AppImage src={msg.senderAvatar} alt={msg.senderName} width={28} height={28} className="w-full h-full object-cover" />
          ) : <span>{msg.senderName.charAt(0)}</span>}
        </div>
      )}
      <div className={`max-w-[72%] flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
        {showSenderName && (
          <span className="text-[10px] font-semibold mb-0.5 px-1" style={{ color: getAvatarColor(msg.senderId) }}>
            {msg.senderName}
          </span>
        )}
        {/* Bubble */}
        <div
          className="px-3 py-2 rounded-2xl cursor-pointer select-none"
          onDoubleClick={() => setShowEmojiPicker(p => !p)}
          style={msg.isSelf ? {
            background: OUTGOING_BG,
            border: `0.7px solid ${OUTGOING_BORDER}`,
            borderBottomRightRadius: '4px',
          } : {
            background: INCOMING_BG,
            border: `0.7px solid ${INCOMING_BORDER}`,
            borderBottomLeftRadius: '4px',
          }}>
          <p className="text-sm leading-relaxed" style={{ color: TEXT_PRIMARY }}>{msg.text}</p>
        </div>

        {/* Reaction counts below bubble */}
        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, users]) => {
              const reactedByMe = users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReaction(msg.id, emoji)}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all"
                  style={{
                    background: reactedByMe ? 'rgba(42,171,238,0.25)' : 'rgba(36,47,61,0.9)',
                    border: `0.7px solid ${reactedByMe ? 'rgba(42,171,238,0.6)' : 'rgba(42,58,74,0.7)'}`,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <span style={{ fontSize: '13px', lineHeight: 1 }}>{emoji}</span>
                  <span style={{ fontSize: '11px', color: reactedByMe ? '#2AABEE' : TEXT_MUTED, fontWeight: 600, lineHeight: 1 }}>
                    {users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji picker on double-tap */}
        {showEmojiPicker && (
          <div className={`mt-1 ${msg.isSelf ? 'flex justify-end' : 'flex justify-start'}`}>
            <EmojiReactionPicker
              isSelf={msg.isSelf}
              onSelect={(emoji) => { onReaction(msg.id, emoji); setShowEmojiPicker(false); }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        <span className="text-[10px] mt-0.5 px-1" style={{ color: TEXT_MUTED }}>{msg.time}</span>
      </div>
    </div>
  );
}

export default function GroupChatDetail({ groupId, groupName, avatarColor, currentUserId, onBack }: GroupChatDetailProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Stable supabase client — prevents real-time channel re-subscription on every render
  const supabase = useMemo(() => createClient(), []);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('id, user_id, role, user_profiles(id, username, display_name, avatar_url)')
      .eq('group_id', groupId);

    if (data) {
      setMembers(data as GroupMember[]);
      const myMembership = data.find((m: any) => m.user_id === currentUserId);
      setIsAdmin(myMembership?.role === 'admin');
    }
  }, [groupId, currentUserId, supabase]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('group_messages')
        .select('id, sender_id, content, created_at, reactions, user_profiles(display_name, username, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          text: m.content || '',
          time: formatTime(m.created_at),
          isSelf: m.sender_id === currentUserId,
          senderName: m.user_profiles?.display_name || m.user_profiles?.username || 'Unknown',
          senderAvatar: m.user_profiles?.avatar_url || undefined,
          senderId: m.sender_id,
          reactions: m.reactions || {},
        })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [groupId, currentUserId, supabase]);

  useEffect(() => {
    fetchMessages();
    fetchMembers();

    const channel = supabase
      .channel(`group_${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const msg = payload.new as any;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name, username, avatar_url')
          .eq('id', msg.sender_id)
          .single();

        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id,
            text: msg.content || '',
            time: formatTime(msg.created_at),
            isSelf: msg.sender_id === currentUserId,
            senderName: profile?.display_name || profile?.username || 'Unknown',
            senderAvatar: profile?.avatar_url || undefined,
            senderId: msg.sender_id,
            reactions: msg.reactions || {},
          }];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const msg = payload.new as any;
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, reactions: msg.reactions || {} } : m
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, currentUserId, fetchMessages, fetchMembers, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleReaction(msgId: string, emoji: string) {
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}) };
      const users: string[] = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUserId);
      if (idx >= 0) { users.splice(idx, 1); if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users; }
      else { reactions[emoji] = [...users, currentUserId]; }
      return { ...m, reactions };
    }));

    try {
      const { data: current } = await supabase.from('group_messages').select('reactions').eq('id', msgId).single();
      const reactions: Record<string, string[]> = { ...(current?.reactions || {}) };
      const users: string[] = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUserId);
      if (idx >= 0) { users.splice(idx, 1); if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users; }
      else { reactions[emoji] = [...users, currentUserId]; }
      await supabase.from('group_messages').update({ reactions }).eq('id', msgId);
    } catch { /* silent */ }
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');

    const optimisticId = `opt-${Date.now()}`;
    const myProfile = members.find(m => m.user_id === currentUserId);
    const myName = myProfile?.user_profiles?.display_name || myProfile?.user_profiles?.username || 'You';

    setMessages(prev => [...prev, {
      id: optimisticId,
      text,
      time: formatTime(new Date().toISOString()),
      isSelf: true,
      senderName: myName,
      senderId: currentUserId,
      reactions: {},
    }]);

    try {
      const { data } = await supabase
        .from('group_messages')
        .insert({ group_id: groupId, sender_id: currentUserId, content: text })
        .select('id')
        .single();

      if (data) {
        setMessages(prev => prev.map(m =>
          m.id === optimisticId ? { ...m, id: data.id } : m
        ));
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  }

  async function handleRemoveMember(userId: string) {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  }

  async function handleLeaveGroup() {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUserId);
    onBack();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: BG }}>
      {showMembers && (
        <MembersDrawer
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setShowMembers(false)}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 relative shrink-0"
        style={{ background: HEADER_BG, borderBottom: `0.7px solid ${DIVIDER}`, zIndex: 40 }}>
        <button onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
          style={{ color: TEXT_PRIMARY }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <button onClick={() => setShowMembers(true)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0"
            style={{ background: avatarColor }}>
            {groupName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: TEXT_PRIMARY }}>{groupName}</p>
            <p className="text-[10px] leading-tight" style={{ color: TEXT_MUTED }}>
              {members.length} member{members.length !== 1 ? 's' : ''} · tap to view
            </p>
          </div>
        </button>

        <button onClick={handleLeaveGroup}
          className="text-xs px-2.5 py-1.5 rounded-lg shrink-0"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
          Leave
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-4 space-y-1" style={{ background: BG, ...DOT_BG_STYLE }}>
        <div className="flex items-center justify-center my-3">
          <span className="px-4 py-1 text-[11px] font-medium"
            style={{ background: DATE_SEP_BG, border: `0.7px solid ${DATE_SEP_BORDER}`, borderRadius: '2px', color: TEXT_MUTED }}>
            Today
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.8">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(37,99,168,0.15)', border: `1px solid ${OUTGOING_BORDER}` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>No messages yet</p>
            <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prevMsg = messages[idx - 1];
            const showSenderName = !msg.isSelf && (!prevMsg || prevMsg.senderId !== msg.senderId);
            return (
              <GroupMessageBubble
                key={msg.id}
                msg={msg}
                showSenderName={showSenderName}
                currentUserId={currentUserId}
                onReaction={handleReaction}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 px-3 py-2.5 flex items-end gap-2"
        style={{ background: COMPOSER_BG, borderTop: `0.7px solid ${COMPOSER_BORDER}` }}>
        <div className="flex-1 relative">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={`Message ${groupName}…`}
            rows={1}
            className="w-full px-4 py-2.5 rounded-2xl text-sm resize-none outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: TEXT_PRIMARY,
              border: `0.7px solid ${COMPOSER_BORDER}`,
              maxHeight: '100px',
              lineHeight: '1.4',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-opacity"
          style={{ background: inputText.trim() ? PRIMARY : 'rgba(42,171,238,0.2)', opacity: inputText.trim() ? 1 : 0.5 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
