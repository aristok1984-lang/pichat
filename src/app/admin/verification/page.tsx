'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  created_at: string;
}

export default function AdminVerificationPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'unverified' | 'verified'>('unverified');
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/sign-up-login-screen');
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.is_admin) { setCheckingAdmin(false); return; }
        setIsAdmin(true);
        setCheckingAdmin(false);
      });
  }, [user]);

  const loadUsers = useCallback(async () => {
    setLoadingData(true);
    let query = supabase
      .from('user_profiles')
      .select('id, username, display_name, email, avatar_url, followers_count, posts_count, is_verified, is_admin, created_at')
      .eq('is_verified', tab === 'verified')
      .order('followers_count', { ascending: false })
      .limit(100);

    if (search.trim()) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data } = await query;
    setUsers(data ?? []);
    setLoadingData(false);
  }, [tab, search]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [isAdmin, loadUsers]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function toggleVerification(u: UserProfile) {
    setActionLoading(u.id);
    const newVal = !u.is_verified;
    try {
      await supabase
        .from('user_profiles')
        .update({ is_verified: newVal, updated_at: new Date().toISOString() })
        .eq('id', u.id);

      await supabase.from('admin_actions').insert({
        admin_id: user!.id,
        action_type: newVal ? 'grant_verification' : 'revoke_verification',
        target_type: 'user',
        target_id: u.id,
        reason: newVal ? 'Verification granted by admin' : 'Verification revoked by admin',
      });

      showToast(`@${u.username} ${newVal ? 'verified ✓' : 'unverified'}`);
      loadUsers();
    } catch (err: any) {
      showToast(err?.message ?? 'Action failed');
    } finally {
      setActionLoading(null);
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
        <button onClick={() => router.push('/social-feed')} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}>
          Go to Feed
        </button>
      </div>
    );
  }

  return (
    <AdminLayout title="Verification Requests" activeSection="verification">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}>
          {toast}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {(['unverified', 'verified'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-semibold capitalize transition-all"
              style={{
                background: tab === t ? 'var(--primary)' : 'var(--muted)',
                color: tab === t ? '#fff' : 'var(--muted-foreground)',
                borderRadius: '2px',
              }}
            >
              {t === 'unverified' ? '⏳ Pending' : '✅ Verified'}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '2px' }}
        />
      </div>

      {/* Info banner */}
      <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(42,151,223,0.08)', border: '1px solid rgba(42,151,223,0.2)', color: 'var(--muted-foreground)', borderRadius: '2px' }}>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Note:</span> Verification grants a blue checkmark (✓) to the user's profile. Use this to authenticate notable accounts.
      </div>

      {/* Users List */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}>
        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No {tab} users found.
          </div>
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
                    {u.is_verified && (
                      <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>✓</span>
                    )}
                    {u.is_admin && (
                      <span className="text-xs px-1.5 py-0.5 font-semibold" style={{ background: 'rgba(42,151,223,0.15)', color: 'var(--primary)', borderRadius: '2px' }}>Admin</span>
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    @{u.username} · {u.followers_count} followers · {u.posts_count} posts
                  </p>
                </div>

                <button
                  onClick={() => toggleVerification(u)}
                  disabled={actionLoading === u.id}
                  className="text-xs px-3 py-1.5 font-semibold transition-all flex-shrink-0"
                  style={{
                    background: u.is_verified ? 'rgba(239,68,68,0.12)' : 'rgba(42,151,223,0.12)',
                    color: u.is_verified ? 'var(--danger)' : 'var(--primary)',
                    borderRadius: '2px',
                    opacity: actionLoading === u.id ? 0.6 : 1,
                  }}
                >
                  {actionLoading === u.id ? '…' : u.is_verified ? 'Revoke ✓' : 'Verify ✓'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
