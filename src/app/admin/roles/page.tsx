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
  avatar_url: string;
  is_admin: boolean;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
}

const ROLE_DEFINITIONS = [
  {
    role: 'Administrator',
    icon: '👑',
    color: '#2A97DF',
    bg: 'rgba(42,151,223,0.1)',
    description: 'Full platform access. Can manage users, communities, content, and system settings.',
    permissions: ['Manage all users', 'Delete any content', 'Access admin panel', 'Grant/revoke roles', 'View platform stats', 'Manage communities', 'System configuration'],
  },
  {
    role: 'Moderator',
    icon: '🛡️',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.1)',
    description: 'Content moderation access. Can review reports and moderate posts.',
    permissions: ['Review reports', 'Delete posts', 'Suspend users (temp)', 'View flagged content', 'Dismiss reports'],
  },
  {
    role: 'Verified User',
    icon: '✅',
    color: '#2A97DF',
    bg: 'rgba(42,151,223,0.08)',
    description: 'Verified identity. Blue checkmark displayed on profile.',
    permissions: ['Blue checkmark badge', 'Enhanced trust signals', 'Priority in search'],
  },
  {
    role: 'Member',
    icon: '👤',
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
    description: 'Standard platform member. Default role for all registered users.',
    permissions: ['Create posts', 'Join communities', 'Send messages', 'Follow users', 'React to content'],
  },
];

export default function AdminRolesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
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

  const loadAdmins = useCallback(async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, is_admin, is_verified, is_suspended, created_at')
      .eq('is_admin', true)
      .order('created_at', { ascending: true });
    setAdmins(data ?? []);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdmins();
  }, [isAdmin, loadAdmins]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function revokeAdmin(u: UserProfile) {
    if (u.id === user?.id) {
      showToast('Cannot revoke your own admin role');
      return;
    }
    setActionLoading(u.id);
    try {
      await supabase.from('user_profiles').update({ is_admin: false }).eq('id', u.id);
      await supabase.from('admin_actions').insert({
        admin_id: user!.id,
        action_type: 'revoke_admin',
        target_type: 'user',
        target_id: u.id,
        reason: 'Admin role revoked',
      });
      showToast(`Admin role revoked from @${u.username}`);
      loadAdmins();
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
        <button onClick={() => router.push('/social-feed')} className="px-4 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}>
          Go to Feed
        </button>
      </div>
    );
  }

  return (
    <AdminLayout title="Roles & Permissions" activeSection="roles">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}>
          {toast}
        </div>
      )}

      <div className="space-y-6">
        {/* Role Definitions */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Platform Roles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ROLE_DEFINITIONS.map((def) => (
              <div
                key={def.role}
                className="p-4 space-y-2"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{def.icon}</span>
                  <span className="text-sm font-bold" style={{ color: def.color }}>{def.role}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{def.description}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {def.permissions.map((p) => (
                    <span
                      key={p}
                      className="text-xs px-2 py-0.5"
                      style={{ background: def.bg, color: def.color, borderRadius: '2px' }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Admins */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Current Administrators
          </h2>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}>
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : admins.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No administrators found.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {admins.map((u) => (
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
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {u.display_name || u.username}
                        </span>
                        {u.is_verified && (
                          <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>✓</span>
                        )}
                        {u.id === user?.id && (
                          <span className="text-xs px-1.5 py-0.5 font-semibold" style={{ background: 'rgba(42,151,223,0.15)', color: 'var(--primary)', borderRadius: '2px' }}>You</span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        @{u.username} · Admin since {new Date(u.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {u.id !== user?.id && (
                      <button
                        onClick={() => revokeAdmin(u)}
                        disabled={actionLoading === u.id}
                        className="text-xs px-3 py-1.5 font-medium flex-shrink-0"
                        style={{
                          background: 'rgba(239,68,68,0.12)',
                          color: 'var(--danger)',
                          borderRadius: '2px',
                          opacity: actionLoading === u.id ? 0.6 : 1,
                        }}
                      >
                        {actionLoading === u.id ? '…' : 'Revoke Admin'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grant Admin */}
        <div className="px-4 py-3 text-sm" style={{ background: 'rgba(42,151,223,0.06)', border: '1px solid rgba(42,151,223,0.2)', borderRadius: '2px', color: 'var(--muted-foreground)' }}>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>To grant admin:</span> Go to{' '}
          <button
            onClick={() => router.push('/admin/users')}
            className="underline font-medium"
            style={{ color: 'var(--primary)' }}
          >
            User Management
          </button>
          , find the user, and use the "Make Admin" action.
        </div>
      </div>
    </AdminLayout>
  );
}
