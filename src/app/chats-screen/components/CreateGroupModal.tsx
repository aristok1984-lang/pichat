'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';

const BG = '#0E1621';
const HEADER_BG = '#17212B';
const DIVIDER = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY = '#E8EDF2';
const TEXT_MUTED = '#7C8FA3';
const PRIMARY = '#2AABEE';
const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface CreateGroupModalProps {
  currentUserId: string;
  onClose: () => void;
  onGroupCreated: (groupId: string, groupName: string, avatarColor: string) => void;
}

export default function CreateGroupModal({ currentUserId, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [step, setStep] = useState<'select' | 'name'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const supabase = createClient();

  const searchUsers = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      let q = supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', currentUserId)
        .limit(20);

      if (query.trim()) {
        q = q.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
      }

      const { data } = await q;
      setUsers(data || []);
    } catch {
      // silent
    } finally {
      setSearchLoading(false);
    }
  }, [currentUserId, supabase]);

  useEffect(() => {
    searchUsers('');
  }, [searchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  function toggleUser(user: UserProfile) {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) return prev.filter(u => u.id !== user.id);
      return [...prev, user];
    });
  }

  async function handleCreate() {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      // Create group chat
      const { data: group, error } = await supabase
        .from('group_chats')
        .insert({
          name: groupName.trim(),
          created_by: currentUserId,
          members_count: selectedUsers.length + 1,
        })
        .select('id')
        .single();

      if (error || !group) throw error;

      // Add creator as admin
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: currentUserId,
        role: 'admin',
      });

      // Add selected members
      const memberInserts = selectedUsers.map(u => ({
        group_id: group.id,
        user_id: u.id,
        role: 'member',
      }));
      await supabase.from('group_members').insert(memberInserts);

      onGroupCreated(group.id, groupName.trim(), getAvatarColor(group.id));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden flex flex-col"
        style={{ background: BG, border: `1px solid ${DIVIDER}`, maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: HEADER_BG, borderBottom: `1px solid ${DIVIDER}` }}>
          <button onClick={onClose} className="text-sm" style={{ color: TEXT_MUTED }}>Cancel</button>
          <h2 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>
            {step === 'select' ? 'New Group' : 'Group Name'}
          </h2>
          {step === 'select' ? (
            <button
              onClick={() => selectedUsers.length > 0 && setStep('name')}
              className="text-sm font-semibold"
              style={{ color: selectedUsers.length > 0 ? PRIMARY : TEXT_MUTED }}>
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!groupName.trim() || loading}
              className="text-sm font-semibold"
              style={{ color: groupName.trim() && !loading ? PRIMARY : TEXT_MUTED }}>
              {loading ? 'Creating…' : 'Create'}
            </button>
          )}
        </div>

        {step === 'select' ? (
          <>
            {/* Selected chips */}
            {selectedUsers.length > 0 && (
              <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0"
                style={{ borderBottom: `1px solid ${DIVIDER}` }}>
                {selectedUsers.map(u => (
                  <button key={u.id} onClick={() => toggleUser(u)}
                    className="flex flex-col items-center gap-1 shrink-0">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: getAvatarColor(u.id) }}>
                        {u.avatar_url ? (
                          <AppImage src={u.avatar_url} alt={u.display_name || u.username} width={40} height={40} className="w-full h-full object-cover" />
                        ) : <span>{(u.display_name || u.username).charAt(0)}</span>}
                      </div>
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px]"
                        style={{ background: '#EF4444' }}>✕</span>
                    </div>
                    <span className="text-[10px] truncate max-w-[40px]" style={{ color: TEXT_MUTED }}>
                      {u.display_name || u.username}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="px-4 py-2 shrink-0" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: TEXT_MUTED }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search people…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY, border: `1px solid ${DIVIDER}` }}
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2" />
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                </div>
              ) : users.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: TEXT_MUTED }}>No users found</p>
              ) : (
                users.map(user => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  return (
                    <button key={user.id} onClick={() => toggleUser(user)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold shrink-0"
                        style={{ background: getAvatarColor(user.id) }}>
                        {user.avatar_url ? (
                          <AppImage src={user.avatar_url} alt={user.display_name || user.username} width={40} height={40} className="w-full h-full object-cover" />
                        ) : <span>{(user.display_name || user.username).charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold truncate" style={{ color: TEXT_PRIMARY }}>
                          {user.display_name || user.username}
                        </p>
                        <p className="text-xs truncate" style={{ color: TEXT_MUTED }}>@{user.username}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: isSelected ? PRIMARY : DIVIDER, background: isSelected ? PRIMARY : 'transparent' }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="px-4 py-3 shrink-0" style={{ borderTop: `1px solid ${DIVIDER}` }}>
                <p className="text-xs text-center" style={{ color: TEXT_MUTED }}>
                  {selectedUsers.length} participant{selectedUsers.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col px-4 py-6 gap-6">
            {/* Group avatar preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: groupName ? getAvatarColor(groupName) : 'rgba(255,255,255,0.1)' }}>
                {groupName ? groupName.charAt(0).toUpperCase() : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                )}
              </div>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>
                {selectedUsers.length + 1} members
              </p>
            </div>

            {/* Group name input */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: TEXT_MUTED }}>
                Group Name
              </label>
              <input
                type="text"
                placeholder="Enter group name…"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                maxLength={50}
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY, border: `1px solid ${DIVIDER}` }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: TEXT_MUTED }}>{groupName.length}/50</p>
            </div>

            {/* Members preview */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: TEXT_MUTED }}>
                Members
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                    style={{ background: 'rgba(42,171,238,0.12)', border: `1px solid rgba(42,171,238,0.25)` }}>
                    <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ background: getAvatarColor(u.id) }}>
                      {u.avatar_url ? (
                        <AppImage src={u.avatar_url} alt={u.display_name || u.username} width={20} height={20} className="w-full h-full object-cover" />
                      ) : <span>{(u.display_name || u.username).charAt(0)}</span>}
                    </div>
                    <span className="text-xs" style={{ color: TEXT_PRIMARY }}>{u.display_name || u.username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
