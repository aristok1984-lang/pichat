'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import StatusBarTime from '@/components/StatusBarTime';

type SettingsSection = 'main' | 'account' | 'privacy' | 'notifications' | 'appearance';
type Theme = 'dark' | 'light' | 'system';
type FontSize = 'small' | 'medium' | 'large';

interface PrivacySettings {
  profileVisibility: 'public' | 'followers' | 'private';
  whoCanMessage: 'everyone' | 'followers' | 'nobody';
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  allowTagging: boolean;
}

interface NotificationSettings {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  communityPosts: boolean;
  mentions: boolean;
}

interface AppearanceSettings {
  theme: Theme;
  fontSize: FontSize;
  reduceMotion: boolean;
  compactMode: boolean;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center w-11 h-6 transition-colors duration-200 focus:outline-none"
      style={{ background: checked ? 'var(--primary)' : 'var(--muted)', borderRadius: '9999px' }}
    >
      <span
        className="inline-block w-4 h-4 bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)', borderRadius: '9999px' }}
      />
    </button>
  );
}

function SettingRow({
  icon,
  label,
  description,
  right,
  onClick,
  borderTop = true,
}: {
  icon: string;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  borderTop?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-muted transition-all' : ''}`}
      style={{ borderTop: borderTop ? '1px solid var(--border)' : 'none' }}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-base flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-foreground" style={{ fontSize: '15px' }}>{label}</p>
          {description && <p className="text-muted-foreground mt-0.5" style={{ fontSize: '10.5px' }}>{description}</p>}
        </div>
      </div>
      {right && <div className="ml-3 flex-shrink-0">{right}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontSize: '10.5px' }}>{title}</p>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [section, setSection] = useState<SettingsSection>('main');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [userProfile, setUserProfile] = useState<{ display_name: string; username: string; is_admin?: boolean } | null>(null);
  const supabase = createClient();

  // Privacy state
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profileVisibility: 'public',
    whoCanMessage: 'everyone',
    showOnlineStatus: true,
    showReadReceipts: true,
    allowTagging: true,
  });

  // Notification state
  const [notifs, setNotifs] = useState<NotificationSettings>({
    pushEnabled: false,
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    communityPosts: true,
    mentions: true,
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  // Appearance state
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'dark',
    fontSize: 'medium',
    reduceMotion: false,
    compactMode: false,
  });

  // Load persisted settings and user profile on mount
  useEffect(() => {
    // Load appearance from localStorage
    try {
      const savedAppearance = localStorage.getItem('pichat_appearance');
      if (savedAppearance) {
        const parsed: AppearanceSettings = JSON.parse(savedAppearance);
        setAppearance(parsed);
        applyAppearance(parsed);
      }
    } catch {}

    // Load privacy from localStorage
    try {
      const savedPrivacy = localStorage.getItem('pichat_privacy');
      if (savedPrivacy) {
        setPrivacy(JSON.parse(savedPrivacy));
      }
    } catch {}

    // Check existing push permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setPushStatus('granted');
        setNotifs((prev) => ({ ...prev, pushEnabled: true }));
      } else if (Notification.permission === 'denied') {
        setPushStatus('denied');
      }
    }
  }, []);

  // Fetch user profile for display name
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('display_name, username, is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setUserProfile(data);
      });
  }, [user]);

  // Persist privacy to localStorage and Supabase whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pichat_privacy', JSON.stringify(privacy));
    } catch {}
    if (!user) return;
    supabase
      .from('user_profiles')
      .update({
        profile_visibility: privacy.profileVisibility,
        who_can_message: privacy.whoCanMessage,
        show_online_status: privacy.showOnlineStatus,
        show_read_receipts: privacy.showReadReceipts,
        allow_tagging: privacy.allowTagging,
      })
      .eq('id', user.id)
      .then(() => {});
  }, [privacy]);

  // Persist appearance to localStorage and apply CSS vars whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('pichat_appearance', JSON.stringify(appearance));
    } catch {}
    applyAppearance(appearance);
  }, [appearance]);

  function applyAppearance(a: AppearanceSettings) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // Font size
    const fontSizeMap: Record<FontSize, string> = { small: '14px', medium: '16px', large: '18px' };
    root.style.setProperty('--app-font-size', fontSizeMap[a.fontSize]);
    // Reduce motion
    if (a.reduceMotion) {
      root.style.setProperty('--transition-duration', '0ms');
    } else {
      root.style.removeProperty('--transition-duration');
    }
    // Theme
    if (a.theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (a.theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
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
    setPwMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPwError(error.message); return; }
      setPwMessage('Password updated successfully!');
      setCurrentPassword('');
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

  async function handlePushToggle(enable: boolean) {
    if (!enable) {
      setNotifs((prev) => ({ ...prev, pushEnabled: false }));
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('denied');
      alert('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatus('granted');
        setNotifs((prev) => ({ ...prev, pushEnabled: true }));
        // Register SW and subscribe
        const reg = await navigator.serviceWorker.ready;
        // Try to subscribe (VAPID key placeholder — works without it for basic push)
        try {
          const existing = await reg.pushManager.getSubscription();
          if (!existing) {
            await reg.pushManager.subscribe({ userVisibleOnly: true });
          }
        } catch {
          // Push subscription may fail without VAPID — notification permission still granted
        }
        // Show a test notification
        if (reg.showNotification) {
          reg.showNotification('PiChat Notifications Enabled', {
            body: "You'll now receive push notifications from PiChat.",
            icon: '/pichat-logo.svg',
          });
        }
      } else {
        setPushStatus('denied');
        setNotifs((prev) => ({ ...prev, pushEnabled: false }));
      }
    } catch (err) {
      console.error('Push subscription error:', err);
    } finally {
      setPushLoading(false);
    }
  }

  function updatePrivacy<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) {
    setPrivacy((prev) => ({ ...prev, [key]: value }));
  }

  function updateNotif<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setNotifs((prev) => ({ ...prev, [key]: value }));
  }

  function updateAppearance<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setAppearance((prev) => ({ ...prev, [key]: value }));
  }

  const sectionTitle: Record<SettingsSection, string> = {
    main: 'Settings',
    account: 'Change Password',
    privacy: 'Privacy',
    notifications: 'Notifications',
    appearance: 'Appearance',
  };

  const mainGroups = [
    {
      title: 'Account',
      items: [
        { icon: '🔒', label: 'Change Password', action: () => setSection('account') },
        { icon: '📧', label: 'Email', value: user?.email, action: () => {} },
        { icon: '🔖', label: 'Bookmarks', action: () => router.push('/bookmarks') },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { icon: '👁️', label: 'Privacy Settings', value: '', action: () => setSection('privacy') },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { icon: '🔔', label: 'Notification Settings', value: '', action: () => setSection('notifications') },
      ],
    },
    {
      title: 'Appearance',
      items: [
        { icon: '🎨', label: 'Appearance', value: '', action: () => setSection('appearance') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: '❓', label: 'Help Center', action: () => {} },
        { icon: '📋', label: 'Terms of Service', action: () => {} },
        { icon: '🔐', label: 'Privacy Policy', action: () => {} },
      ],
    },
    ...(userProfile?.is_admin ? [{
      title: 'Administration',
      items: [
        { icon: '🛡️', label: 'Admin Panel', value: '', action: () => router.push('/admin') },
      ],
    }] : []),
  ];

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        <div className="status-bar">
          <StatusBarTime />
        </div>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-3 pb-3 border-b border-border flex items-center gap-3" style={{ background: 'var(--secondary)' }}>
            {section !== 'main' ? (
              <button onClick={() => setSection('main')} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-bold text-foreground">{sectionTitle[section]}</h1>
          </div>

          <div className="flex-1 overflow-y-auto pb-20">
            {/* ── MAIN ── */}
            {section === 'main' && (
              <>
                <div className="flex items-center gap-3 px-4 py-4 border-b border-border" style={{ background: 'var(--secondary)' }}>
                  <div className="w-12 h-12 flex items-center justify-center font-bold text-white"
                    style={{ background: 'var(--primary)', borderRadius: '50%', fontSize: '18px' }}>
                    {(userProfile?.display_name || user?.email)?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-foreground" style={{ fontSize: '15px' }}>{userProfile?.display_name || user?.email}</p>
                    {userProfile?.username && (
                      <p className="text-muted-foreground" style={{ fontSize: '10.5px' }}>@{userProfile.username}</p>
                    )}
                    <button onClick={() => router.push('/profile')} className="font-semibold" style={{ color: 'var(--primary)', fontSize: '12px' }}>
                      View Profile →
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-5">
                  {mainGroups.map((group) => (
                    <div key={group.title}>
                      <p className="font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontSize: '10.5px' }}>{group.title}</p>
                      <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                        {group.items.map((item, idx) => (
                          <button
                            key={item.label}
                            onClick={item.action}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-all text-left"
                            style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base">{item.icon}</span>
                              <span className="text-foreground" style={{ fontSize: '15px' }}>{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.value && <span className="text-muted-foreground" style={{ fontSize: '10.5px' }}>{item.value}</span>}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleSignOut}
                    className="w-full py-3 font-semibold border transition-all"
                    style={{ borderColor: 'rgba(239,68,68,0.3)', color: 'var(--danger)', background: 'rgba(239,68,68,0.06)', fontSize: '15px', borderRadius: '2px' }}
                  >
                    Sign Out
                  </button>
                  <p className="text-center text-muted-foreground" style={{ fontSize: '10.5px' }}>PiChat v1.0.0 · GATEWAY TO KNOWLEDGE</p>
                </div>
              </>
            )}

            {/* ── ACCOUNT / CHANGE PASSWORD ── */}
            {section === 'account' && (
              <div className="p-4 space-y-4">
                <p className="text-muted-foreground" style={{ fontSize: '13px' }}>Update your account password below.</p>
                {pwMessage && (
                  <div className="p-3 border" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', fontSize: '13px', borderColor: 'rgba(16,185,129,0.2)', borderRadius: '2px' }}>{pwMessage}</div>
                )}
                {pwError && (
                  <div className="p-3 border" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', fontSize: '13px', borderColor: 'rgba(239,68,68,0.2)', borderRadius: '2px' }}>{pwError}</div>
                )}
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-foreground mb-1" style={{ fontSize: '13px' }}>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2.5 outline-none"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '15px', borderRadius: '2px' }}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-foreground mb-1" style={{ fontSize: '13px' }}>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2.5 outline-none"
                      style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '15px', borderRadius: '2px' }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={pwLoading || !newPassword || !confirmPassword}
                  className="w-full py-3 font-semibold transition-all"
                  style={{
                    background: newPassword && confirmPassword ? 'var(--primary)' : 'var(--muted)',
                    color: newPassword && confirmPassword ? 'white' : 'var(--muted-foreground)',
                    fontSize: '15px',
                    borderRadius: '2px',
                  }}
                >
                  {pwLoading ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            )}

            {/* ── PRIVACY ── */}
            {section === 'privacy' && (
              <div className="p-4 space-y-5">
                <SectionHeader title="Profile" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  <SettingRow
                    icon="👁️"
                    label="Profile Visibility"
                    description="Who can see your profile"
                    borderTop={false}
                    right={
                      <select
                        value={privacy.profileVisibility}
                        onChange={(e) => updatePrivacy('profileVisibility', e.target.value as PrivacySettings['profileVisibility'])}
                        className="px-2 py-1 outline-none"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '12px', borderRadius: '2px' }}
                      >
                        <option value="public">Public</option>
                        <option value="followers">Followers</option>
                        <option value="private">Private</option>
                      </select>
                    }
                  />
                  <SettingRow
                    icon="💬"
                    label="Who Can Message Me"
                    description="Control who can send you messages"
                    right={
                      <select
                        value={privacy.whoCanMessage}
                        onChange={(e) => updatePrivacy('whoCanMessage', e.target.value as PrivacySettings['whoCanMessage'])}
                        className="px-2 py-1 outline-none"
                        style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', fontSize: '12px', borderRadius: '2px' }}
                      >
                        <option value="everyone">Everyone</option>
                        <option value="followers">Followers</option>
                        <option value="nobody">Nobody</option>
                      </select>
                    }
                  />
                  <SettingRow
                    icon="🏷️"
                    label="Allow Tagging"
                    description="Let others tag you in posts"
                    right={<Toggle checked={privacy.allowTagging} onChange={(v) => updatePrivacy('allowTagging', v)} />}
                  />
                </div>

                <SectionHeader title="Activity" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  <SettingRow
                    icon="🟢"
                    label="Show Online Status"
                    description="Let others see when you're active"
                    borderTop={false}
                    right={<Toggle checked={privacy.showOnlineStatus} onChange={(v) => updatePrivacy('showOnlineStatus', v)} />}
                  />
                  <SettingRow
                    icon="✅"
                    label="Read Receipts"
                    description="Show when you've read messages"
                    right={<Toggle checked={privacy.showReadReceipts} onChange={(v) => updatePrivacy('showReadReceipts', v)} />}
                  />
                </div>

                <div className="p-3 text-muted-foreground" style={{ background: 'var(--muted)', fontSize: '12px', borderRadius: '2px' }}>
                  Changes are saved automatically and take effect immediately.
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {section === 'notifications' && (
              <div className="p-4 space-y-5">
                <SectionHeader title="Push Notifications" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  <SettingRow
                    icon="🔔"
                    label="Enable Push Notifications"
                    description={
                      pushStatus === 'denied' ? 'Blocked in browser — enable in site settings'
                        : pushStatus === 'granted' ? 'Active — you will receive alerts' : 'Tap to allow browser notifications'
                    }
                    borderTop={false}
                    right={
                      pushLoading ? (
                        <div className="w-8 h-4 flex items-center justify-center">
                          <div className="w-3 h-3 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        </div>
                      ) : (
                        <Toggle checked={notifs.pushEnabled} onChange={handlePushToggle} />
                      )
                    }
                  />
                  {pushStatus === 'denied' && (
                    <div className="px-4 py-2" style={{ color: 'var(--danger)', borderTop: '1px solid var(--border)', fontSize: '12px' }}>
                      ⚠️ Notifications are blocked. Open browser site settings to allow them.
                    </div>
                  )}
                </div>

                <SectionHeader title="Activity Alerts" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  {[
                    { key: 'likes' as const, icon: '❤️', label: 'Likes', description: 'When someone likes your post' },
                    { key: 'comments' as const, icon: '💬', label: 'Comments', description: 'When someone comments on your post' },
                    { key: 'follows' as const, icon: '👥', label: 'New Followers', description: 'When someone follows you' },
                    { key: 'mentions' as const, icon: '@', label: 'Mentions', description: 'When someone mentions you' },
                  ].map((item, idx) => (
                    <SettingRow
                      key={item.key}
                      icon={item.icon}
                      label={item.label}
                      description={item.description}
                      borderTop={idx > 0}
                      right={<Toggle checked={notifs[item.key]} onChange={(v) => updateNotif(item.key, v)} />}
                    />
                  ))}
                </div>

                <SectionHeader title="Messages & Communities" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  {[
                    { key: 'messages' as const, icon: '✉️', label: 'Direct Messages', description: 'New message notifications' },
                    { key: 'communityPosts' as const, icon: '🏘️', label: 'Community Posts', description: 'New posts in your communities' },
                  ].map((item, idx) => (
                    <SettingRow
                      key={item.key}
                      icon={item.icon}
                      label={item.label}
                      description={item.description}
                      borderTop={idx > 0}
                      right={<Toggle checked={notifs[item.key]} onChange={(v) => updateNotif(item.key, v)} />}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── APPEARANCE ── */}
            {section === 'appearance' && (
              <div className="p-4 space-y-5">
                <SectionHeader title="Theme" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  {(['dark', 'light', 'system'] as Theme[]).map((t, idx) => (
                    <button
                      key={t}
                      onClick={() => updateAppearance('theme', t)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-all"
                      style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '⚙️'}</span>
                        <span className="text-foreground capitalize" style={{ fontSize: '15px' }}>{t === 'system' ? 'System Default' : `${t.charAt(0).toUpperCase() + t.slice(1)} Mode`}</span>
                      </div>
                      {appearance.theme === t && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                <SectionHeader title="Text Size" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  {(['small', 'medium', 'large'] as FontSize[]).map((size, idx) => (
                    <button
                      key={size}
                      onClick={() => updateAppearance('fontSize', size)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-all"
                      style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">🔤</span>
                        <span className="text-foreground capitalize" style={{ fontSize: '15px' }}>{size}</span>
                      </div>
                      {appearance.fontSize === size && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                <SectionHeader title="Accessibility" />
                <div className="overflow-hidden border border-border" style={{ background: 'var(--card)', borderRadius: '2px' }}>
                  <SettingRow
                    icon="🎞️"
                    label="Reduce Motion"
                    description="Minimize animations and transitions"
                    borderTop={false}
                    right={<Toggle checked={appearance.reduceMotion} onChange={(v) => updateAppearance('reduceMotion', v)} />}
                  />
                  <SettingRow
                    icon="📐"
                    label="Compact Mode"
                    description="Show more content with less spacing"
                    right={<Toggle checked={appearance.compactMode} onChange={(v) => updateAppearance('compactMode', v)} />}
                  />
                </div>

                <div className="p-3 text-muted-foreground" style={{ background: 'var(--muted)', fontSize: '12px', borderRadius: '2px' }}>
                  Theme and font size changes apply immediately.
                </div>
              </div>
            )}
          </div>

          <BottomNav activeTab="profile" />
        </div>
      </MobileFrame>
    </div>
  );
}
