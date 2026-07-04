'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '../components/AdminLayout';

interface Post {
  id: string;
  content: string;
  image_url: string;
  video_url: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: { username: string; display_name: string; avatar_url: string } | null;
}

interface Reel {
  id: string;
  caption: string;
  video_url: string;
  thumbnail_url: string;
  likes_count: number;
  views_count: number;
  is_active: boolean;
  created_at: string;
  author: { username: string; display_name: string } | null;
}

export default function AdminContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<'posts' | 'reels'>(
    (searchParams.get('tab') as 'posts' | 'reels') ?? 'posts'
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'post' | 'reel'; label: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const loadPosts = useCallback(async () => {
    setLoadingContent(true);
    let query = supabase
      .from('posts')
      .select('id, content, image_url, video_url, likes_count, comments_count, created_at, author:author_id(username, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (search.trim()) query = query.ilike('content', `%${search}%`);
    const { data } = await query;
    setPosts((data ?? []) as Post[]);
    setLoadingContent(false);
  }, [search]);

  const loadReels = useCallback(async () => {
    setLoadingContent(true);
    let query = supabase
      .from('reels')
      .select('id, caption, video_url, thumbnail_url, likes_count, views_count, is_active, created_at, author:author_id(username, display_name)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (search.trim()) query = query.ilike('caption', `%${search}%`);
    const { data } = await query;
    setReels((data ?? []) as Reel[]);
    setLoadingContent(false);
  }, [search]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => {
      if (tab === 'posts') loadPosts();
      else loadReels();
    }, 300);
    return () => clearTimeout(t);
  }, [isAdmin, tab, loadPosts, loadReels]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      if (confirmDelete.type === 'post') {
        await supabase.from('posts').delete().eq('id', confirmDelete.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'delete_post',
          target_type: 'post',
          target_id: confirmDelete.id,
          reason: deleteReason,
        });
        setPosts((prev) => prev.filter((p) => p.id !== confirmDelete.id));
        showToast('Post deleted');
      } else {
        await supabase.from('reels').update({ is_active: false }).eq('id', confirmDelete.id);
        await supabase.from('admin_actions').insert({
          admin_id: user!.id,
          action_type: 'deactivate_reel',
          target_type: 'reel',
          target_id: confirmDelete.id,
          reason: deleteReason,
        });
        setReels((prev) => prev.map((r) => r.id === confirmDelete.id ? { ...r, is_active: false } : r));
        showToast('Reel deactivated');
      }
      setConfirmDelete(null);
      setDeleteReason('');
    } catch (err: any) {
      showToast(err?.message ?? 'Action failed');
    } finally {
      setDeleteLoading(false);
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
    <AdminLayout title="Content Moderation" activeSection="content">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg" style={{ background: 'var(--primary)', color: '#fff' }}>
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-2">
          {(['posts', 'reels'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-all"
              style={{
                background: tab === t ? 'var(--primary)' : 'var(--muted)',
                color: tab === t ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {t === 'posts' ? '📝 Posts' : '🎬 Reels'}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={`Search ${tab}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
          style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {loadingContent ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : tab === 'posts' ? (
          posts.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No posts found.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {posts.map((post) => (
                <div key={post.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                        @{post.author?.username ?? 'unknown'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      {post.image_url && <span className="text-xs">🖼️</span>}
                      {post.video_url && <span className="text-xs">🎬</span>}
                    </div>
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {post.content || '(no text)'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      ❤️ {post.likes_count} · 💬 {post.comments_count}
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmDelete({ id: post.id, type: 'post', label: post.content?.slice(0, 40) || 'this post' })}
                    className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          reels.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>No reels found.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {reels.map((reel) => (
                <div key={reel.id} className="px-4 py-3 flex items-start gap-3">
                  {reel.thumbnail_url && (
                    <img src={reel.thumbnail_url} alt="Reel thumbnail" className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                        @{reel.author?.username ?? 'unknown'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(reel.created_at).toLocaleDateString()}
                      </span>
                      {!reel.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>Deactivated</span>
                      )}
                    </div>
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--foreground)' }}>
                      {reel.caption || '(no caption)'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      ❤️ {reel.likes_count} · 👁️ {reel.views_count}
                    </p>
                  </div>
                  {reel.is_active && (
                    <button
                      onClick={() => setConfirmDelete({ id: reel.id, type: 'reel', label: reel.caption?.slice(0, 40) || 'this reel' })}
                      className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
              {confirmDelete.type === 'post' ? '🗑️ Delete Post' : '🎬 Deactivate Reel'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              "{confirmDelete.label}"
            </p>
            <textarea
              placeholder="Reason (optional)"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ background: 'var(--input)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmDelete(null); setDeleteReason(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--danger)', color: '#fff', opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
