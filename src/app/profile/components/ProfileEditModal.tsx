'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
}

interface ProfileEditModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSave: (updated: Partial<UserProfile>) => void;
}

export default function ProfileEditModal({ profile, onClose, onSave }: ProfileEditModalProps) {
  const supabase = createClient();

  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');

  // Preview states (local blob URLs for real-time preview)
  const [avatarPreview, setAvatarPreview] = useState<string>(profile.avatar_url || '');
  const [bannerPreview, setBannerPreview] = useState<string>(profile.banner_url || '');

  // Pending file objects (uploaded on save)
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
  function getAvatarColor(username: string) {
    const idx = username?.charCodeAt(0) % AVATAR_COLORS.length || 0;
    return AVATAR_COLORS[idx];
  }

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }, []);

  const handleBannerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreview(url);
  }, []);

  async function uploadFile(bucket: string, file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      let newAvatarUrl = profile.avatar_url;
      let newBannerUrl = profile.banner_url;

      if (avatarFile) {
        newAvatarUrl = await uploadFile('avatars', avatarFile, profile.id);
      }
      if (bannerFile) {
        newBannerUrl = await uploadFile('banners', bannerFile, profile.id);
      }

      const updates: Partial<UserProfile> = {
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: newAvatarUrl,
        banner_url: newBannerUrl,
      };

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      onSave(updates);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--secondary)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <button onClick={onClose} className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
            Cancel
          </button>
          <h2 className="text-base font-bold text-foreground">Edit Profile</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-bold px-3 py-1 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Banner section */}
          <div className="relative">
            <div
              className="h-28 w-full relative cursor-pointer group"
              style={{ background: bannerPreview ? undefined : 'linear-gradient(135deg, #0E1621, #1a2d42, #2AABEE22)' }}
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <AppImage
                  src={bannerPreview}
                  alt="Profile banner"
                  width={400}
                  height={112}
                  className="w-full h-full object-cover"
                />
              ) : null}
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col items-center gap-1">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-xs text-white font-semibold">Change Banner</span>
                </div>
              </div>
              {/* Always-visible edit badge */}
              <div
                className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--primary)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleBannerChange}
            />

            {/* Avatar overlapping banner */}
            <div className="px-4">
              <div className="relative inline-block -mt-10 mb-3">
                <div
                  className="w-20 h-20 rounded-full border-4 overflow-hidden flex items-center justify-center text-2xl font-bold text-white cursor-pointer group"
                  style={{ borderColor: 'var(--background)', background: getAvatarColor(profile.username || 'u') }}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <AppImage
                      src={avatarPreview}
                      alt={`${profile.display_name} avatar`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile.display_name?.charAt(0)?.toUpperCase() || '?'
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </div>
                {/* Edit badge */}
                <div
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2"
                  style={{ background: 'var(--primary)', borderColor: 'var(--background)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Form fields */}
          <div className="px-4 pb-6 space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Your display name"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-foreground outline-none border border-border focus:border-primary transition-colors"
                style={{ background: 'var(--background)' }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--muted-foreground)' }}>
                {displayName.length}/50
              </p>
            </div>

            {/* Username (read-only) */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Username
              </label>
              <div
                className="w-full px-3 py-2.5 rounded-xl text-sm border border-border flex items-center gap-1"
                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
              >
                <span>@</span>
                <span>{profile.username}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Username cannot be changed</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={4}
                placeholder="Tell people about yourself…"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-foreground outline-none border border-border focus:border-primary transition-colors resize-none"
                style={{ background: 'var(--background)' }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--muted-foreground)' }}>
                {bio.length}/160
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: '#ef444422', color: '#ef4444' }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
