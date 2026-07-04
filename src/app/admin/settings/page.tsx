'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'toggle' | 'info';
  value?: boolean;
  infoValue?: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCommunities: 0,
    totalPosts: 0,
    totalReels: 0,
    verifiedUsers: 0,
    adminUsers: 0,
    suspendedUsers: 0,
    pendingReports: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

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
        loadStats();
      });
  }, [user]);

  async function loadStats() {
    setLoadingStats(true);
    const results = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('reels').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_admin', true),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', true),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setStats({
      totalUsers: results[0].count ?? 0,
      totalCommunities: results[1].count ?? 0,
      totalPosts: results[2].count ?? 0,
      totalReels: results[3].count ?? 0,
      verifiedUsers: results[4].count ?? 0,
      adminUsers: results[5].count ?? 0,
      suspendedUsers: results[6].count ?? 0,
      pendingReports: results[7].count ?? 0,
    });
    setLoadingStats(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
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

  const platformStats = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'var(--primary)', href: '/admin/users' },
    { label: 'Verified Users', value: stats.verifiedUsers, icon: '✅', color: '#2A97DF', href: '/admin/verification' },
    { label: 'Administrators', value: stats.adminUsers, icon: '👑', color: '#F59E0B', href: '/admin/roles' },
    { label: 'Suspended', value: stats.suspendedUsers, icon: '🚫', color: 'var(--danger)', href: '/admin/users?filter=suspended' },
    { label: 'Communities', value: stats.totalCommunities, icon: '🏘️', color: '#10B981', href: '/admin/communities' },
    { label: 'Total Posts', value: stats.totalPosts, icon: '📝', color: 'var(--accent)', href: '/admin/content' },
    { label: 'Total Reels', value: stats.totalReels, icon: '🎬', color: '#8B5CF6', href: '/admin/content?tab=reels' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: '⚠️', color: '#F59E0B', href: '/admin/reports' },
  ];

  const systemInfo = [
    { label: 'Platform', value: 'PiChat' },
    { label: 'Version', value: '1.0.0' },
    { label: 'Framework', value: 'Next.js 15' },
    { label: 'Database', value: 'Supabase (PostgreSQL)' },
    { label: 'Site URL', value: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pichat.us' },
    { label: 'Auth Provider', value: 'Supabase Auth' },
  ];

  const quickActions = [
    { label: 'User Management', icon: '👥', href: '/admin/users', desc: 'Manage, suspend, or promote users' },
    { label: 'Community Oversight', icon: '🏘️', href: '/admin/communities', desc: 'View and manage all communities' },
    { label: 'Content Moderation', icon: '🛡️', href: '/admin/content', desc: 'Review and remove flagged content' },
    { label: 'Reports Queue', icon: '🚨', href: '/admin/reports', desc: 'Process pending user reports' },
    { label: 'Verification', icon: '✅', href: '/admin/verification', desc: 'Grant or revoke verified status' },
    { label: 'Roles & Permissions', icon: '🔑', href: '/admin/roles', desc: 'Manage admin roles and permissions' },
  ];

  return (
    <AdminLayout title="System Settings" activeSection="settings">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}>
          {toast}
        </div>
      )}

      <div className="space-y-6">
        {/* Platform Statistics */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Platform Statistics
          </h2>
          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {platformStats.map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => router.push(stat.href)}
                  className="p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}
                >
                  <div className="text-xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value.toLocaleString()}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="p-4 text-left transition-all hover:opacity-80"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{action.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{action.label}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* System Information */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-foreground)' }}>
            System Information
          </h2>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px' }}>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {systemInfo.map((item) => (
                <div key={item.label} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--danger)' }}>
            Danger Zone
          </h2>
          <div className="p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '2px' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Destructive actions are performed via database migrations. Use the Supabase dashboard for schema-level operations.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => showToast('Use Supabase dashboard for database operations')}
                className="text-xs px-3 py-2 font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '2px' }}
              >
                🗄️ Database Console
              </button>
              <button
                onClick={() => router.push('/admin/reports')}
                className="text-xs px-3 py-2 font-medium"
                style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', borderRadius: '2px' }}
              >
                🚨 Review Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
