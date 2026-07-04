'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import StatusBarTime from '@/components/StatusBarTime';

const CATEGORIES = [
  'Technology', 'Gaming', 'Music', 'Art & Design', 'Sports', 'Science',
  'Education', 'Health & Fitness', 'Food & Cooking', 'Travel', 'Finance',
  'Entertainment', 'Politics', 'Fashion', 'Photography', 'Other',
];

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string;
  banner_url: string;
  category: string;
  rules: string;
  is_private: boolean;
  owner_id: string;
}

export default function EditCommunityPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const { user, loading: authLoading } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [rules, setRules] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-up-login-screen');
      return;
    }
    if (!authLoading && user && slug) {
      fetchCommunity();
    }
  }, [user, authLoading, slug]);

  async function fetchCommunity() {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('communities')
        .select('*')
        .eq('slug', slug)
        .single();

      if (fetchErr || !data) {
        router.push('/communities');
        return;
      }

      // Check if user is owner or admin
      const isOwner = data.owner_id === user?.id;
      let isAdmin = false;
      if (!isOwner) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('role')
          .eq('community_id', data.id)
          .eq('user_id', user?.id)
          .single();
        isAdmin = memberData?.role === 'admin' || memberData?.role === 'owner';
      }

      if (!isOwner && !isAdmin) {
        router.push(`/communities/${slug}`);
        return;
      }

      setIsOwnerOrAdmin(true);
      setCommunity(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setCategory(data.category || '');
      setRules(data.rules || '');
      setAvatarUrl(data.avatar_url || '');
      setBannerUrl(data.banner_url || '');
      setIsPrivate(data.is_private || false);
    } catch (err) {
      router.push('/communities');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Community name is required'); return; }
    if (!community) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateErr } = await supabase
        .from('communities')
        .update({
          name: name.trim(),
          description: description.trim(),
          category: category || 'Other',
          rules: rules.trim(),
          avatar_url: avatarUrl.trim(),
          banner_url: bannerUrl.trim(),
          is_private: isPrivate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', community.id);

      if (updateErr) {
        setError(updateErr.message || 'Failed to save changes');
        return;
      }

      setSuccess('Community updated successfully!');
      setTimeout(() => {
        router.push(`/communities/${slug}`);
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
        <MobileFrame>
          <div className="flex items-center justify-center h-full">
            <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          </div>
        </MobileFrame>
      </div>
    );
  }

  if (!user || !community || !isOwnerOrAdmin) return null;

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3 pb-3 flex items-center gap-3 border-b border-border shrink-0" style={{ background: 'var(--secondary)' }}>
            <button
              onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-foreground flex-1">Edit Community</h1>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
              style={{
                background: saving || !name.trim() ? 'var(--muted)' : 'var(--primary)',
                color: saving || !name.trim() ? 'var(--muted-foreground)' : 'white',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: '24px' }}>
            {error && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                {success}
              </div>
            )}

            {/* Banner URL */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Banner Image URL</label>
              {bannerUrl && (
                <div className="w-full h-20 rounded-xl overflow-hidden mb-2" style={{ background: 'var(--muted)' }}>
                  <img src={bannerUrl} alt="Banner preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <input
                type="url"
                placeholder="https://example.com/banner.jpg"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Avatar Image URL</label>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center text-xl font-bold text-white shrink-0"
                  style={{ background: avatarUrl ? 'transparent' : 'var(--primary)' }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    name.charAt(0).toUpperCase() || 'C'
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Community Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/500</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Rules */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Community Rules</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Set rules for your community members…"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{rules.length}/1000</p>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">Visibility</label>
              <div className="grid grid-cols-2 gap-2">
                {(['public', 'private'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setIsPrivate(v === 'private')}
                    className="flex flex-col items-start p-3 rounded-xl border transition-all duration-150"
                    style={{
                      background: (v === 'private') === isPrivate ? 'rgba(42,171,238,0.1)' : 'var(--muted)',
                      borderColor: (v === 'private') === isPrivate ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: (v === 'private') === isPrivate ? 'var(--primary)' : 'var(--border)' }}
                      >
                        {(v === 'private') === isPrivate && (
                          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-foreground capitalize">{v}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {v === 'public' ? 'Anyone can join and view' : 'Only invited members can join'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Handle info */}
            <div className="p-3 rounded-xl" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs text-muted-foreground">
                Handle: <span className="font-semibold text-foreground">@{community.slug}</span> · The handle cannot be changed after creation.
              </p>
            </div>
          </div>
        </div>
      </MobileFrame>
    </div>
  );
}
