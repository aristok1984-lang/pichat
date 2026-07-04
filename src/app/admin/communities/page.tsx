'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string;
  members_count: number;
  posts_count: number;
  is_private: boolean;
  created_at: string;
  owner: { username: string; display_name: string } | null;
}

export default function AdminCommunitiesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: 'delete' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const loadCommunities = useCallback(async () => {
    setLoadingData(true);
    let query = supabase
      .from('communities')
      .select('id, name, slug, description, avatar_url, members_count, posts_count, is_private, created_at, owner:owner_id(username, display_name)')
      .order('members_count', { ascending: false })
      .limit(100);

    if (search.trim()) query = query.ilike('name', `%${search}%`);

    const { data } = await query;
    setCommunities((data ?? []) as Community[]);
    setLoadingData(false);
  }, [search]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(loadCommunities, 300);
    return () => clearTimeout(t);
  }, [isAdmin, loadCommunities]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleDeleteCommunity() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      await supabase.from('communities').delete().eq('id', confirmAction.id);
      await supabase.from('admin_actions').insert({
        admin_id: user!.id,
        action_type: 'delete_community',
        target_type: 'community',
        target_id: confirmAction.id,
        reason: 'Admin removal',
      });
      setCommunities((prev) => prev.filter((c) => c.id !== confirmAction.id));
      showToast(`Community "${confirmAction.name}" deleted`);
      setConfirmAction(null);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete community');
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
    <AdminLayout title="Community Oversight" activeSection="communities">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff' }}>
          {toast}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search communities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
          style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* Communities List */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : communities.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No communities found.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {communities.map((community) => (
              <div key={community.id} className="px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base font-bold"
                  style={{ background: community.avatar_url ? 'transparent' : 'var(--muted)', color: 'var(--primary)' }}
                >
                  {community.avatar_url ? (
                    <img src={community.avatar_url} alt={`${community.name} community avatar`} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    community.name?.[0]?.toUpperCase() ?? '#'
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {community.name}
                    </span>
                    {community.is_private && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,143,163,0.2)', color: 'var(--muted-foreground)' }}>Private</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    👥 {community.members_count} members · 📝 {community.posts_count} posts · Owner: @{community.owner?.username ?? 'unknown'}
                  </p>
                  {community.description && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                      {community.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => router.push(`/communities/${community.slug}`)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(42,171,238,0.15)', color: 'var(--primary)' }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => setConfirmAction({ id: community.id, name: community.name, action: 'delete' })}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>🗑️ Delete Community</h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--foreground)' }}>{confirmAction.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCommunity}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--danger)', color: '#fff', opacity: actionLoading ? 0.7 : 1 }}
              >
                {actionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
