'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import StatusBarTime from '@/components/StatusBarTime';
import AppImage from '@/components/ui/AppImage';

// ─── Types ────────────────────────────────────────────────────────────────────

type Privacy = 'public' | 'contacts' | 'private';

interface FieldPrivacy {
  full_name?: Privacy;
  username?: Privacy;
  bio?: Privacy;
  occupation?: Privacy;
  location?: Privacy;
  birthplace?: Privacy;
  studied_at?: Privacy;
  went_to?: Privacy;
  x_account?: Privacy;
  email?: Privacy;
  phone?: Privacy;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  occupation: string;
  location: string;
  birthplace: string;
  studied_at: string;
  went_to: string;
  x_account: string;
  email: string;
  phone: string;
  is_verified: boolean;
  field_privacy: FieldPrivacy;
  created_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

type Section = 'main' | 'password';

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function getAvatarColor(username: string) {
  const idx = (username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Privacy Selector ─────────────────────────────────────────────────────────

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: React.ReactNode }[] = [
  {
    value: 'public',
    label: 'Public',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
      </svg>
    ),
  },
  {
    value: 'contacts',
    label: 'Contacts',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    value: 'private',
    label: 'Private',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
];

function PrivacySelector({
  value,
  onChange,
}: {
  value: Privacy;
  onChange: (v: Privacy) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = PRIVACY_OPTIONS.find((o) => o.value === value) ?? PRIVACY_OPTIONS[0];

  const privacyColor: Record<Privacy, string> = {
    public: '#10b981',
    contacts: '#2AABEE',
    private: '#8B5CF6',
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
        style={{
          background: `${privacyColor[value]}18`,
          color: privacyColor[value],
          border: `1px solid ${privacyColor[value]}40`,
        }}
      >
        {current.icon}
        {current.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden border border-border shadow-xl"
          style={{ background: 'var(--secondary)', minWidth: 120 }}
        >
          {PRIVACY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
              style={{ color: privacyColor[opt.value] }}
            >
              {opt.icon}
              {opt.label}
              {opt.value === value && (
                <svg className="ml-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0"
      style={{ background: checked ? 'var(--primary)' : 'var(--muted)' }}
    >
      <span
        className="inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  privacyKey,
  privacy,
  onPrivacyChange,
  children,
}: {
  label: string;
  privacyKey: keyof FieldPrivacy;
  privacy: FieldPrivacy;
  onPrivacyChange: (key: keyof FieldPrivacy, value: Privacy) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </label>
        <PrivacySelector
          value={privacy[privacyKey] ?? 'public'}
          onChange={(v) => onPrivacyChange(privacyKey, v)}
        />
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('main');

  // Editable fields
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
  const [birthplace, setBirthplace] = useState('');
  const [studiedAt, setStudiedAt] = useState('');
  const [wentTo, setWentTo] = useState('');
  const [xAccount, setXAccount] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldPrivacy, setFieldPrivacy] = useState<FieldPrivacy>({});

  // Avatar / banner
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/sign-up-login-screen');
      return;
    }
    fetchProfile();
  }, [user, authLoading]);

  async function fetchProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist yet — create it
        const fallbackUsername =
          user.user_metadata?.username ||
          user.email?.split('@')[0] ||
          `user_${user.id.slice(0, 8)}`;
        const { data: created } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            username: fallbackUsername,
            display_name: user.user_metadata?.display_name || fallbackUsername,
            full_name: user.user_metadata?.full_name || '',
          })
          .select()
          .single();
        if (created) populateForm(created);
      } else if (data) {
        populateForm(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function populateForm(data: UserProfile) {
    setProfile(data);
    setDisplayName(data.display_name || '');
    setFullName(data.full_name || '');
    setUsername(data.username || '');
    setBio(data.bio || '');
    setOccupation(data.occupation || '');
    setLocation(data.location || '');
    setBirthplace(data.birthplace || '');
    setStudiedAt(data.studied_at || '');
    setWentTo(data.went_to || '');
    setXAccount(data.x_account || '');
    setPhone(data.phone || '');
    setFieldPrivacy(data.field_privacy || {});
    setAvatarPreview(data.avatar_url || '');
    setBannerPreview(data.banner_url || '');
  }

  function handlePrivacyChange(key: keyof FieldPrivacy, value: Privacy) {
    setFieldPrivacy((prev) => ({ ...prev, [key]: value }));
  }

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }, []);

  const handleBannerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }, []);

  async function uploadFile(bucket: string, file: File, userId: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      let newAvatarUrl = profile.avatar_url;
      let newBannerUrl = profile.banner_url;
      if (avatarFile) newAvatarUrl = await uploadFile('avatars', avatarFile, profile.id);
      if (bannerFile) newBannerUrl = await uploadFile('banners', bannerFile, profile.id);

      const updates = {
        display_name: displayName.trim(),
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        occupation: occupation.trim(),
        location: location.trim(),
        birthplace: birthplace.trim(),
        studied_at: studiedAt.trim(),
        went_to: wentTo.trim(),
        x_account: xAccount.trim().replace(/^@/, ''),
        phone: phone.trim(),
        avatar_url: newAvatarUrl,
        banner_url: newBannerUrl,
        field_privacy: fieldPrivacy,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      setAvatarFile(null);
      setBannerFile(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    setPwError('');
    setPwSuccess('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err?.message || 'Failed to update password');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/sign-up-login-screen');
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl text-sm text-foreground outline-none border border-border focus:border-primary transition-colors';
  const inputStyle = { background: 'var(--background)' };

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        {/* Status bar */}
        <div className="status-bar">
          <StatusBarTime />
          <div className="flex items-center gap-1.5">
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" className="text-foreground">
              <rect x="0" y="4" width="3" height="7" rx="0.5" opacity="0.4" />
              <rect x="4" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.6" />
              <rect x="8" y="1" width="3" height="10" rx="0.5" opacity="0.8" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div
            className="px-4 pt-3 pb-3 flex items-center justify-between flex-shrink-0 border-b border-border"
            style={{ background: 'var(--secondary)' }}
          >
            <button
              onClick={() => (section === 'password' ? setSection('main') : router.back())}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-foreground">
              {section === 'password' ? 'Change Password' : 'Edit Profile'}
            </h1>
            {section === 'main' ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-bold rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                {saving ? (
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                ) : (
                  'Save'
                )}
              </button>
            ) : (
              <div className="w-9" />
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto pb-6">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
              </div>
            ) : section === 'main' ? (
              <>
                {/* ── Banner + Avatar ── */}
                <div className="relative">
                  <div
                    className="h-28 w-full relative cursor-pointer group"
                    style={{
                      background: bannerPreview
                        ? undefined
                        : 'linear-gradient(135deg, #0E1621, #1a2d42, #2AABEE22)',
                    }}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {bannerPreview && (
                      <AppImage
                        src={bannerPreview}
                        alt="Profile banner"
                        width={400}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex flex-col items-center gap-1">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className="text-xs text-white font-semibold">Change Banner</span>
                      </div>
                    </div>
                    <div
                      className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--primary)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                  </div>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />

                  <div className="px-4">
                    <div className="relative inline-block -mt-10 mb-3">
                      <div
                        className="w-20 h-20 rounded-full border-4 overflow-hidden flex items-center justify-center text-2xl font-bold text-white cursor-pointer group"
                        style={{
                          borderColor: 'var(--background)',
                          background: getAvatarColor(profile?.username || 'u'),
                        }}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {avatarPreview ? (
                          <AppImage
                            src={avatarPreview}
                            alt={`${profile?.display_name} avatar`}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          profile?.display_name?.charAt(0)?.toUpperCase() || '?'
                        )}
                        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </div>
                      </div>
                      <div
                        className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2"
                        style={{ background: 'var(--primary)', borderColor: 'var(--background)' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                {/* ── Verification Status ── */}
                <div className="mx-4 mb-4 mt-1 rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{
                    background: profile?.is_verified
                      ? 'rgba(16,185,129,0.08)'
                      : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${profile?.is_verified ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                  }}
                >
                  {profile?.is_verified ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#10b981">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#10b981' }}>Verified Account</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Your identity has been verified</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>Unverified Account</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Verification not yet completed</p>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Privacy Legend ── */}
                <div className="mx-4 mb-4 rounded-xl px-4 py-3 flex items-start gap-2"
                  style={{ background: 'rgba(42,171,238,0.06)', border: '1px solid rgba(42,171,238,0.15)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Use the privacy badge next to each field to control who can see it:
                    <span style={{ color: '#10b981' }}> Public</span> (everyone),
                    <span style={{ color: '#2AABEE' }}> Contacts</span> (followers only), or
                    <span style={{ color: '#8B5CF6' }}> Private</span> (only you).
                  </p>
                </div>

                {/* ── Personal Info ── */}
                <div className="px-4 pb-4 space-y-4" style={{ background: 'var(--secondary)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--muted-foreground)' }}>
                    Personal Info
                  </p>

                  {/* Full Name */}
                  <FieldRow label="Full Name" privacyKey="full_name" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      maxLength={80}
                      placeholder="Your full name"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>

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
                      placeholder="Name shown on your profile"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <p className="text-xs mt-1 text-right" style={{ color: 'var(--muted-foreground)' }}>
                      {displayName.length}/50
                    </p>
                  </div>

                  {/* Username */}
                  <FieldRow label="Username" privacyKey="username" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--primary)' }}>
                        @
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                        maxLength={30}
                        placeholder="username"
                        className={`${inputClass} pl-7`}
                        style={inputStyle}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                      Letters, numbers, and underscores only
                    </p>
                  </FieldRow>

                  {/* Bio */}
                  <FieldRow label="Bio" privacyKey="bio" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={160}
                      rows={3}
                      placeholder="Tell people about yourself…"
                      className={`${inputClass} resize-none`}
                      style={inputStyle}
                    />
                    <p className="text-xs mt-1 text-right" style={{ color: 'var(--muted-foreground)' }}>
                      {bio.length}/160
                    </p>
                  </FieldRow>

                  {/* Occupation */}
                  <FieldRow label="Occupation" privacyKey="occupation" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. Software Engineer"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>

                  {/* Location */}
                  <FieldRow label="Location" privacyKey="location" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. Athens, Greece"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>

                  {/* Birthplace */}
                  <FieldRow label="Birthplace" privacyKey="birthplace" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={birthplace}
                      onChange={(e) => setBirthplace(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. Thessaloniki, Greece"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>

                  {/* Studied At */}
                  <FieldRow label="Studied At" privacyKey="studied_at" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={studiedAt}
                      onChange={(e) => setStudiedAt(e.target.value)}
                      maxLength={100}
                      placeholder="e.g. University of Athens"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>

                  {/* Went To */}
                  <FieldRow label="Went To" privacyKey="went_to" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="text"
                      value={wentTo}
                      onChange={(e) => setWentTo(e.target.value)}
                      maxLength={100}
                      placeholder="e.g. Athens College"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>
                </div>

                {/* ── Contact Info ── */}
                <div className="mt-3 px-4 pb-4 space-y-4" style={{ background: 'var(--secondary)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider pt-3" style={{ color: 'var(--muted-foreground)' }}>
                    Contact Info
                  </p>

                  {/* X Account */}
                  <FieldRow label="X (Twitter)" privacyKey="x_account" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                        @
                      </span>
                      <input
                        type="text"
                        value={xAccount}
                        onChange={(e) => setXAccount(e.target.value.replace(/^@/, ''))}
                        maxLength={50}
                        placeholder="x_username"
                        className={`${inputClass} pl-7`}
                        style={inputStyle}
                      />
                    </div>
                  </FieldRow>

                  {/* Email (read-only from auth) */}
                  <FieldRow label="Email" privacyKey="email" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <div
                      className="w-full px-3 py-2.5 rounded-xl text-sm border border-border flex items-center gap-2"
                      style={{ background: 'var(--background)', color: 'var(--muted-foreground)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span className="truncate flex-1">{user?.email || '—'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                        read-only
                      </span>
                    </div>
                  </FieldRow>

                  {/* Phone */}
                  <FieldRow label="Phone" privacyKey="phone" privacy={fieldPrivacy} onPrivacyChange={handlePrivacyChange}>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={30}
                      placeholder="+30 210 000 0000"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </FieldRow>
                </div>

                {/* Member since */}
                {profile?.created_at && (
                  <div className="mx-4 mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Member since {formatDate(profile.created_at)}
                  </div>
                )}

                {/* Save feedback */}
                {saveError && (
                  <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    {saveError}
                  </div>
                )}
                {saveSuccess && (
                  <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Profile saved successfully!
                  </div>
                )}

                {/* ── Security ── */}
                <div className="mt-3 px-4 pb-4" style={{ background: 'var(--secondary)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider pt-3 pb-3" style={{ color: 'var(--muted-foreground)' }}>
                    Security
                  </p>
                  <div className="rounded-2xl overflow-hidden border border-border" style={{ background: 'var(--background)' }}>
                    <button
                      onClick={() => setSection('password')}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">Change Password</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Update your account password</p>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ── Account ── */}
                <div className="mt-3 px-4 pb-6" style={{ background: 'var(--secondary)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider pt-3 pb-3" style={{ color: 'var(--muted-foreground)' }}>
                    Account
                  </p>
                  <div className="rounded-2xl overflow-hidden border border-border" style={{ background: 'var(--background)' }}>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ── Change Password ── */
              <div className="px-4 pt-6 pb-6 space-y-5" style={{ background: 'var(--secondary)', minHeight: '100%' }}>
                <div
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.2)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Choose a strong password with at least 6 characters.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className={`${inputClass} pr-10`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className={`${inputClass} pr-10`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPw ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>
                  )}
                  {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 6 && (
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#10b981' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Passwords match
                    </p>
                  )}
                </div>

                {pwError && (
                  <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div className="px-3 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {pwSuccess}
                  </div>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={pwLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)', color: 'white' }}
                >
                  {pwLoading ? (
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 00-9-9" />
                    </svg>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Update Password
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </MobileFrame>
    </div>
  );
}
