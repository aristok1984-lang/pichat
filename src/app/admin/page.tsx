'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from './components/AdminLayout';

interface DashboardStats {
  totalUsers: number;
  suspendedUsers: number;
  totalPosts: number;
  totalReels: number;
  totalCommunities: number;
  pendingReports: number;
  reviewedReports: number;
  actionedReports: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    suspendedUsers: 0,
    totalPosts: 0,
    totalReels: 0,
    totalCommunities: 0,
    pendingReports: 0,
    reviewedReports: 0,
    actionedReports: 0,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [recentActions, setRecentActions] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-up-login-screen');
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    checkAdminAndLoad();
  }, [user]);

  async function checkAdminAndLoad() {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user!.id)
      .single();

    if (!profile?.is_admin) {
      setCheckingAdmin(false);
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    setCheckingAdmin(false);
    await loadStats();
    await loadRecentActions();
  }

  async function loadStats() {
    const results = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', true),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('reels').select('*', { count: 'exact', head: true }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'reviewed'),
      supabase.from('content_reports').select('*', { count: 'exact', head: true }).eq('status', 'actioned'),
    ]);

    const totalUsers = results[0].count;
    const suspendedUsers = results[1].count;
    const totalPosts = results[2].count;
    const totalReels = results[3].count;
    const totalCommunities = results[4].count;
    const pendingReports = results[5].count;
    const reviewedReports = results[6].count;
    const actionedReports = results[7].count;

    setStats({
      totalUsers: totalUsers ?? 0,
      suspendedUsers: suspendedUsers ?? 0,
      totalPosts: totalPosts ?? 0,
      totalReels: totalReels ?? 0,
      totalCommunities: totalCommunities ?? 0,
      pendingReports: pendingReports ?? 0,
      reviewedReports: reviewedReports ?? 0,
      actionedReports: actionedReports ?? 0,
    });
  }

  async function loadRecentActions() {
    const { data } = await supabase
      .from('admin_actions')
      .select('*, admin:admin_id(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentActions(data ?? []);
  }

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }}>
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Access Denied</h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>You do not have admin privileges.</p>
        <button
          onClick={() => router.push('/social-feed')}
          className="px-6 py-2 text-sm font-semibold rounded-lg"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          Go to Feed
        </button>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'var(--primary)', href: '/admin/users' },
    { label: 'Suspended', value: stats.suspendedUsers, icon: '🚫', color: 'var(--danger)', href: '/admin/users?filter=suspended' },
    { label: 'Posts', value: stats.totalPosts, icon: '📝', color: 'var(--accent)', href: '/admin/content' },
    { label: 'Reels', value: stats.totalReels, icon: '🎬', color: '#F59E0B', href: '/admin/content?tab=reels' },
    { label: 'Communities', value: stats.totalCommunities, icon: '🏘️', color: '#10B981', href: '/admin/communities' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: '⚠️', color: '#F59E0B', href: '/admin/reports' },
    { label: 'Reviewed', value: stats.reviewedReports, icon: '✅', color: '#10B981', href: '/admin/reports?status=reviewed' },
    { label: 'Actioned', value: stats.actionedReports, icon: '⚡', color: 'var(--primary)', href: '/admin/reports?status=actioned' },
  ];

  return (
    <AdminLayout title="Dashboard" activeSection="dashboard">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <button
              key={card.label}
              onClick={() => router.push(card.href)}
              className="p-4 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold font-tabular" style={{ color: card.color }}>{card.value.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{card.label}</div>
            </button>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Manage Users', icon: '👤', href: '/admin/users' },
              { label: 'Review Reports', icon: '🚨', href: '/admin/reports' },
              { label: 'Moderate Content', icon: '🛡️', href: '/admin/content' },
              { label: 'Communities', icon: '🏘️', href: '/admin/communities' },
              { label: 'Verification', icon: '✅', href: '/admin/verification' },
              { label: 'Roles & Perms', icon: '🔑', href: '/admin/roles' },
              { label: 'System Settings', icon: '⚙️', href: '/admin/settings' },
              { label: 'Platform Stats', icon: '📊', href: '/admin/settings' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', borderRadius: '2px' }}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Admin Actions */}
        <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Recent Actions</h2>
          </div>
          {recentActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No admin actions recorded yet.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentActions.map((action) => (
                <div key={action.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'var(--muted)' }}>
                    {action.action_type === 'suspend_user' ? '🚫' : action.action_type === 'delete_post' ? '🗑️' : action.action_type === 'dismiss_report' ? '✅' : '⚡'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {action.action_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      by @{action.admin?.username ?? 'admin'} · {action.reason || 'No reason provided'}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(action.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
