'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string;
  followers_count: number;
  posts_count: number;
  is_verified: boolean;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_reason: string;
  created_at: string;
}

export default function AdminUsersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(searchParams.get('filter') ?? 'all');
  const [actionUser, setActionUser] = useState<UserProfile | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'unsuspend' | 'make_admin' | 'remove_admin' | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/sign-up-login-screen');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_profiles').select('is_admin').eq('id', user.id).single().then(({ data }) => {
      if (!data?.is_admin) { setCheckingAdmin(false); return; }
      setIsAdmin(true);
      setCheckingAdmin(false);
    });
  }, [user]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    let query = supabase
      .from('user_profiles')
      .select('id, username, display_name, email, avatar_url, followers_count, posts_count, is_verified, is_admin, is_suspended, suspended_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'suspended') query = query.eq('is_suspended', true);
    if (filter === 'admins') query = query.eq('is_admin', true);
    if (search.trim()) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data } = await query;
    setUsers(data ?? []);
    setLoadingUsers(false);
  }, [filter, search]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [isAdmin, loadUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleAction() {
    if (!actionUser || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === 'suspend') {
        await supabase.from('user_profiles').update({
          is_suspended: true,
          suspended_reason: reason,
          suspended_at: new Date().toISOString(),
        }).eq('id', actionUser.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'suspend_user',
          target_type: 'user',
          target_id: actionUser.id,
          reason,
        });
        showToast(`@${actionUser.username} suspended`);
      } else if (actionType === 'unsuspend') {
        await supabase.from('user_profiles').update({
          is_suspended: false,
          suspended_reason: '',
          suspended_at: null,
        }).eq('id', actionUser.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'unsuspend_user',
          target_type: 'user',
          target_id: actionUser.id,
          reason,
        });
        showToast(`@${actionUser.username} unsuspended`);
      } else if (actionType === 'make_admin') {
        await supabase.from('user_profiles').update({ is_admin: true }).eq('id', actionUser.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'grant_admin',
          target_type: 'user',
          target_id: actionUser.id,
          reason,
        });
        showToast(`@${actionUser.username} is now admin`);
      } else if (actionType === 'remove_admin') {
        await supabase.from('user_profiles').update({ is_admin: false }).eq('id', actionUser.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'revoke_admin',
          target_type: 'user',
          target_id: actionUser.id,
          reason,
        });
        showToast(`Admin removed from @${actionUser.username}`);
      }
      setActionUser(null);
      setActionType(null);
      setReason('');
      loadUsers();
    } catch (err: any) {
      showToast(err?.message ?? 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }}>
        <div className="text-5xl">🔒</div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Admin access required.</p>
        <button onClick={() => router.push('/social-feed')} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Go to Feed</button>
      </div>
    );
  }

  return (
    <AdminLayout title="User Management" activeSection="users">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff' }}>
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by username, name, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
          style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
        <div className="flex gap-2">
          {(['all', 'suspended', 'admins'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-2 text-xs font-semibold rounded-lg capitalize transition-all"
              style={{
                background: filter === f ? 'var(--primary)' : 'var(--muted)',
                color: filter === f ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loadingUsers ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No users found.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: u.avatar_url ? 'transparent' : 'var(--muted)', color: 'var(--primary)' }}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={`${u.display_name} avatar`} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    (u.display_name?.[0] ?? u.username?.[0] ?? '?').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {u.display_name || u.username}
                    </span>
                    {u.is_verified && <span className="text-xs">✓</span>}
                    {u.is_admin && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(42,171,238,0.15)', color: 'var(--primary)' }}>Admin</span>
                    )}
                    {u.is_suspended && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>Suspended</span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    @{u.username} · {u.posts_count} posts · {u.followers_count} followers
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {u.is_suspended ? (
                    <button
                      onClick={() => { setActionUser(u); setActionType('unsuspend'); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => { setActionUser(u); setActionType('suspend'); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
                    >
                      Suspend
                    </button>
                  )}
                  {u.is_admin ? (
                    <button
                      onClick={() => { setActionUser(u); setActionType('remove_admin'); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      Revoke Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => { setActionUser(u); setActionType('make_admin'); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(42,171,238,0.15)', color: 'var(--primary)' }}
                    >
                      Make Admin
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionUser && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
              {actionType === 'suspend' ? '🚫 Suspend User' :
               actionType === 'unsuspend' ? '✅ Restore User' :
               actionType === 'make_admin' ? '⭐ Grant Admin' : '🔻 Revoke Admin'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Target: <strong style={{ color: 'var(--foreground)' }}>@{actionUser.username}</strong>
            </p>
            <textarea
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setActionUser(null); setActionType(null); setReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: actionType === 'suspend' ? 'var(--danger)' : 'var(--primary)',
                  color: '#fff',
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
