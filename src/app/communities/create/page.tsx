'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import StatusBarTime from '@/components/StatusBarTime';

const CATEGORIES = [
  'Technology', 'Gaming', 'Music', 'Art & Design', 'Sports', 'Science',
  'Education', 'Health & Fitness', 'Food & Cooking', 'Travel', 'Finance',
  'Entertainment', 'Politics', 'Fashion', 'Photography', 'Other',
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function CreateCommunityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [rules, setRules] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/sign-up-login-screen');
    }
  }, [user, authLoading, router]);

  const slug = slugify(name.trim());

  async function handleCreate() {
    if (!name.trim()) { setError('Community name is required'); return; }
    if (!user) { router.replace('/sign-up-login-screen'); return; }
    setSaving(true);
    setError('');

    try {
      const { data, error: insertErr } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim(),
          category: category || 'Other',
          rules: rules.trim(),
          is_private: visibility === 'private',
          owner_id: user.id,
          members_count: 1,
        })
        .select('id, slug')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          setError('A community with this name or handle already exists. Try a different name.');
        } else {
          setError(insertErr.message || 'Failed to create community');
        }
        return;
      }

      if (data) {
        // Auto-join as owner
        await supabase.from('community_members').insert({
          community_id: data.id,
          user_id: user.id,
          role: 'owner',
        });
        router.push(`/communities/${data.slug}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create community');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
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

  if (!user) return null;

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
            <h1 className="text-base font-bold text-foreground flex-1">Create Community</h1>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
              style={{
                background: saving || !name.trim() ? 'var(--muted)' : 'var(--primary)',
                color: saving || !name.trim() ? 'var(--muted-foreground)' : 'white',
              }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: '24px' }}>
            {error && (
              <div className="p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Community Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Tech Enthusiasts"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
              {name.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  Handle: <span style={{ color: 'var(--primary)' }}>@{slug}</span> · URL: /communities/{slug}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Description</label>
              <textarea
                placeholder="What is this community about?"
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
                placeholder="Set rules for your community members…"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={4}
                maxLength={1000}
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
                    onClick={() => setVisibility(v)}
                    className="flex flex-col items-start p-3 rounded-xl border transition-all duration-150"
                    style={{
                      background: visibility === v ? 'rgba(42,171,238,0.1)' : 'var(--muted)',
                      borderColor: visibility === v ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: visibility === v ? 'var(--primary)' : 'var(--border)' }}
                      >
                        {visibility === v && (
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

            {/* Info */}
            <div className="p-3 rounded-xl" style={{ background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.2)' }}>
              <p className="text-xs" style={{ color: 'var(--primary)' }}>
                You will become the owner and admin of this community. You can edit all settings after creation.
              </p>
            </div>
          </div>
        </div>
      </MobileFrame>
    </div>
  );
}
