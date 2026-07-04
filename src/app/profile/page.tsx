'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';


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
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified: boolean;
  is_founder?: boolean;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  image_url: string;
  created_at: string;
}

function formatJoinDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "'Inter', sans-serif",
    background: '#0E1621',
    color: '#FFFFFF',
    minHeight: '100vh',
    position: 'relative',
  },
  header: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '0.5px solid #2A3648',
    position: 'sticky',
    top: 0,
    background: '#0E1621',
    zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 15, fontWeight: 700, letterSpacing: '0.01em' },
  headerActions: { display: 'flex', gap: 8 },
  btnMsg: {
    background: '#131D2B',
    border: '0.5px solid #2A3648',
    borderRadius: 2,
    color: '#EDE8E0',
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 300,
    letterSpacing: '0.04em',
    padding: '7px 14px',
    cursor: 'pointer',
  },
  btnBlock: {
    background: '#131D2B',
    border: '0.5px solid #2A3648',
    borderRadius: 2,
    color: '#8AAEC8',
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    fontWeight: 300,
    letterSpacing: '0.04em',
    padding: '7px 14px',
    cursor: 'pointer',
  },
  cover: {
    height: 200,
    overflow: 'hidden',
    background: '#131D2B',
    cursor: 'pointer',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: '0 16px',
    marginTop: -32,
    minHeight: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    border: '0.5px solid #2A97DF',
    borderRadius: 2,
    overflow: 'hidden',
    background: '#1A2535',
    flexShrink: 0,
    cursor: 'pointer',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' },
  identity: { padding: '4px 16px 0' },
  name: { fontSize: 18, fontWeight: 600, lineHeight: 1.2 },
  handle: { color: '#2A97DF', fontSize: 16, fontWeight: 300, marginTop: 2 },
  badges: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  badgeVerified: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#1B2531',
    border: '0.5px solid #6A7A8A',
    borderRadius: 2,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 300,
    letterSpacing: '0.03em',
    color: '#3CB371',
    width: 80,
    justifyContent: 'center',
  },
  badgeFounder: {
    background: '#EDE8E0',
    border: '0.5px solid #000000',
    borderRadius: 2,
    color: '#000000',
    fontSize: 11,
    fontWeight: 300,
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
  },
  bioBlock: {
    margin: '8px 16px 0',
    background: '#1A2535',
    border: '0.5px solid #2A3648',
    borderRadius: 2,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bioLocation: {
    fontSize: 12,
    fontWeight: 300,
    color: '#EDE8E0',
    letterSpacing: '0.03em',
    borderBottom: '0.5px solid #2E4060',
    paddingBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  bioText: { fontSize: 13, color: '#B0C4D8', lineHeight: 1.65 },
  bioFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTop: '0.5px solid #2E4060',
  },
  bioJoined: { fontSize: 13, color: '#EDE8E0', display: 'flex', alignItems: 'center', gap: 4 },
  bioMore: { color: '#2A97DF', cursor: 'pointer', fontSize: 12, fontWeight: 300, letterSpacing: '0.03em', textTransform: 'uppercase' },
  statsWrap: {
    margin: '8px 16px 0',
    background: '#1A2535',
    border: '0.5px solid #2A3648',
    borderRadius: 2,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
    padding: '16px 0 14px',
  },
  stats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' },
  statNum: { fontWeight: 800, fontSize: 22, lineHeight: 1 },
  statLbl: { color: '#8AACC8', fontSize: 11, fontWeight: 300, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 14 },
  infoContactsWrap: {
    border: '0.5px solid #2A3648',
    borderRadius: 3,
    margin: '8px 16px 0',
    overflow: 'hidden',
  },
  infoContactsHeader: {
    background: '#131D2B',
    borderBottom: '0.5px solid #2A3648',
    padding: '10px 0 14px',
    textAlign: 'center',
    backgroundImage: 'linear-gradient(rgba(180,210,240,0.25) 0.5px, transparent 0.5px), linear-gradient(90deg, rgba(180,210,240,0.25) 0.5px, transparent 0.5px)',
    backgroundSize: '20px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  infoContactsBody: { background: '#1A2535' },
  infoRow: { display: 'flex', alignItems: 'center', padding: '10px 10px 10px 7px', gap: 10, fontSize: 13 },
  infoLbl: { color: '#B0C4D8', width: 80, flexShrink: 0, fontSize: 12, fontWeight: 300, letterSpacing: '0.03em', textTransform: 'uppercase' },
  infoVal: { color: '#FFFFFF', flex: 1 },
  infoValEmpty: { color: '#5C6D82', fontStyle: 'italic', flex: 1 },
  contactRow: { display: 'flex', alignItems: 'center', padding: '10px 7px', gap: 7, fontSize: 13, justifyContent: 'flex-end', paddingRight: 7, position: 'relative' },
  engageWrap: {
    margin: '8px 16px 0',
    background: '#1A2535',
    border: '0.5px solid #2A3648',
    borderRadius: 3,
    overflow: 'hidden',
  },
  engageHeader: {
    fontSize: 13,
    fontWeight: 300,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#B0C4D8',
    textAlign: 'center',
    padding: '7px 0',
  },
  engageTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' },
  tabEmpty: { textAlign: 'center', padding: '28px 0', fontSize: 11, fontWeight: 300, color: '#3C5268', letterSpacing: '0.08em' },
  dropdown: {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%,-50%)',
    background: 'linear-gradient(160deg, #1A2D42 0%, #0D1E2E 100%)',
    border: '0.5px solid #2A97DF',
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    boxShadow: '0 8px 28px rgba(0,0,0,0.6), 0 0 12px rgba(42,151,223,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
    width: 280,
    overflow: 'hidden',
  },
  dropHeader: {
    fontSize: 12,
    fontWeight: 300,
    letterSpacing: '0.14em',
    color: '#8AAEC8',
    textAlign: 'center',
    padding: '10px 12px 9px',
    borderBottom: '0.5px solid #2A3648',
    textTransform: 'uppercase',
    position: 'relative',
  },
  dropContent: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', gap: 12 },
  dropVal: { color: '#EDE8E0', fontSize: 13, fontWeight: 400, letterSpacing: '0.02em' },
  fullscreenOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.95)',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    background: '#1A2535',
    border: '0.5px solid #2A3648',
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#EDE8E0',
    fontSize: 16,
    zIndex: 1000,
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media'>('posts');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [wallFullscreen, setWallFullscreen] = useState(false);
  const [avatarFullscreen, setAvatarFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);

      const { data: postsData } = await supabase
        .from('posts')
        .select('id, content, image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (postsData) setPosts(postsData);
    } finally {
      setLoading(false);
    }
  }

  function toggleDropdown(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setOpenDropdown(prev => (prev === id ? null : id));
  }

  function copyText(text: string) {
    try { navigator.clipboard.writeText(text); } catch {}
  }

  const displayName = profile?.display_name || profile?.full_name || profile?.username || 'User';
  const handle = profile?.username ? `@${profile.username}` : '';
  const avatarUrl = profile?.avatar_url || '';
  const bannerUrl = profile?.banner_url || '';

  const engageTabStyle = (tab: string): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    padding: '10px 0 8px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 300,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderRight: '1px solid #2A3A4A',
    borderTop: '1px solid #2A3A4A',
    background: activeTab === tab ? '#1A2535' : '#111C29',
    color: activeTab === tab ? '#EDE8E0' : '#4A6A84',
    position: 'relative',
    transition: 'all 0.15s',
  });

  const statStyle = (idx: number): React.CSSProperties => ({
    padding: '0 0 10px',
    cursor: 'pointer',
    position: 'relative',
    borderRight: idx < 2 ? '0.5px solid #2E4060' : 'none',
  });

  return (
    <MobileFrame>
      <div style={styles.root} onClick={() => setOpenDropdown(null)}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 4px', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span style={styles.headerTitle}>Profile</span>
          </div>
          <div style={styles.headerActions}>
            <button onClick={() => router.push('/messages')} style={styles.btnMsg}>Message</button>
            <button style={styles.btnBlock}>Block</button>
          </div>
        </div>

        {/* COVER */}
        <div
          onClick={() => bannerUrl && setWallFullscreen(true)}
          style={{
            ...styles.cover,
            cursor: bannerUrl ? 'pointer' : 'default',
          }}
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #131D2B 0%, #1A2535 100%)' }} />
          )}
        </div>

        {/* Wall Fullscreen Overlay */}
        {wallFullscreen && bannerUrl && (
          <div onClick={() => setWallFullscreen(false)} style={styles.fullscreenOverlay}>
            <span onClick={e => { e.stopPropagation(); setWallFullscreen(false); }} style={styles.fullscreenClose}>✕</span>
            <img src={bannerUrl} alt="Cover fullscreen" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}

        {/* AVATAR ROW */}
        <div style={styles.avatarRow}>
          <div onClick={() => avatarUrl && setAvatarFullscreen(true)} style={{ ...styles.avatar, cursor: avatarUrl ? 'pointer' : 'default' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={styles.avatarImg} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2535' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#4A6A84"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </div>
            )}
          </div>

          {/* Avatar Fullscreen Overlay */}
          {avatarFullscreen && avatarUrl && (
            <div onClick={() => setAvatarFullscreen(false)} style={styles.fullscreenOverlay}>
              <span onClick={e => { e.stopPropagation(); setAvatarFullscreen(false); }} style={styles.fullscreenClose}>✕</span>
              <img src={avatarUrl} alt={displayName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}

          <div style={{ flex: 1, paddingLeft: 12, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={styles.name}>{displayName}</div>
              <button
                onClick={() => router.push('/profile/edit')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#131D2B', border: '0.5px solid #2A3648', borderRadius: 2, padding: '4px 10px', cursor: 'pointer', color: '#B0C4D8', fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 300, letterSpacing: '0.04em', flexShrink: 0 }}
              >
                <svg viewBox="0 0 1352 1320" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
                  <path transform="translate(1064,28)" d="m0 0h23l23 3 19 5 16 6 17 8 14 9 13 10 10 9 11 11 15 20 9 16 8 17 7 23 2 8v10l1 16h-1l-4-14-2-5h-2l4 11 4 21v24l-3 19-5 17-9 20-9 14-11 13-9 10-8 8-14 11-14 10-19 10-21 8-22 5-12 2h-39l-31-6-22-8-21-11-14-10-11-9-18-18-9-12-2-1-2 5-11 20-9 15-30 52-9 15-15 26-16 27-7 12-3 6-3-1-14-25-14-24-12-22-1-4-12 6-24 14-16 9-24 14-26 15-17 10-48 28-21 12-25 15-27 16-17 10-20 12-28 17-14 8-2 1 1 7 5 19 3 21v30l-3 18-6 23-1 5 17 10 26 15 29 17 21 12 15 9 96 56 21 12 26 15 22 13 26 15 22 13 2-5 11-20 10-17 11-19 7-12 2-4 4 4 14 24 30 52 28 48 15 26 10 17 3 6 3-1 8-10 11-12 8-8 14-11 16-10 15-8 19-7 21-5 14-2 23-1 20 2 20 4 20 6 23 11 14 9 13 10 10 9 9 9 13 17 11 18 8 17 6 18 4 17 2 17v30l-3 20-5 19-7 18-8 16-7 11-9 12-9 10-15 15-18 13-16 9-21 9-20 6-15 3-11 1h-25l-18-2-22-5-21-8-23-12-19-14-13-12-9-10-10-13-8-13-9-17-7-19-5-22-2-14v-32l2-15 6-25 7-18 1-2h-207l8-15 12-21 15-26 7-12v-3l-18-10-17-10-26-15-22-13-28-16-51-30-21-12-26-15-20-12-21-12-15-9-48-28-4-3h-4l-7 8-10 10-11 9-11 8-18 10-16 7-20 6-21 4-13 1h-16l-21-2-25-6-19-7-16-8-18-12-13-11-18-18-13-18-9-15-9-22-5-17-4-22-1-14v-13l2-20 6-25 9-24 10-18 10-14 12-14 12-12 14-11 16-10 16-8 15-6 18-5 19-3 14-1h12l21 2 22 5 19 7 14 6 21 13 13 11 8 7 9 9 3 4 5-1 26-15 22-14 16-9 15-9 22-13 10-6 14-8 39-23 17-10 21-12 15-9 26-15 23-13 48-28h2l-3-7-15-26-15-27-10-16v-2h207l-6-14-6-21-3-16-1-8v-33l3-19 6-23 8-18 9-17 9-13 9-11 19-19 18-13 16-9 15-7 21-7 21-4z" fill="#B0C4D8"/>
                </svg>
                Share
              </button>
            </div>
            <div style={styles.handle}>{handle}</div>
          </div>
        </div>

        {/* IDENTITY / BADGES */}
        <div style={styles.identity}>
          <div style={styles.badges}>
            {profile?.is_verified && (
              <div style={styles.badgeVerified}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#2E7D32" d="M12 21.9q-.175 0-.325-.025t-.3-.075Q8 20.675 6 17.638T4 11.1V6.375q0-.625.363-1.125t.937-.725l6-2.25q.35-.125.7-.125t.7.125l6 2.25q.575.225.938.725T20 6.375V11.1q0 3.5-2 6.538T12.625 21.8q-.15.05-.3.075T12 21.9Z"/><path fill="#ffffff" d="m10.95 12.7l-1.4-1.4q-.3-.3-.7-.3t-.7.3q-.3.3-.3.713t.3.712l2.1 2.125q.3.3.7.3t.7-.3l4.25-4.25q.3-.3.3-.712t-.3-.713q-.3-.3-.713-.3t-.712.3Z"/></svg>
                <span style={{ color: '#EDE8E0' }}>Verified</span>
              </div>
            )}
            {profile?.is_founder && (
              <div style={styles.badgeFounder}>
                Founder <span style={{ color: '#0047FF', letterSpacing: 0, fontSize: 8, marginLeft: 2 }}>•••</span>
              </div>
            )}
          </div>
        </div>

        {/* BIO BLOCK */}
        <div style={styles.bioBlock}>
          <div style={styles.bioLocation}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2q3.8 0 6.588 2.45t3.312 6.1q-.5-.25-1.037-.387T19.75 10q-.475-1.825-1.713-3.25T15 4.6V5q0 .825-.587 1.413T13 7h-2v2q0 .425-.288.713T10 10H8v2h6q.275 0 .513.138t.362.387q-.425.675-.65 1.425T14 15.5q0 1.575.813 2.925t1.662 2.525q-1.025.5-2.15.775T12 22m-1-2.05V18q-.825 0-1.412-.587T9 16v-1l-4.8-4.8q-.075.45-.137.9T4 12q0 3.025 1.988 5.3T11 19.95M19.5 22q-.175 0-.3-.1t-.175-.25q-.275-.875-.775-1.625t-1.075-1.475q-.525-.65-.85-1.425T16 15.5q0-1.45 1.025-2.475T19.5 12t2.475 1.025T23 15.5q0 .85-.337 1.613t-.838 1.437q-.575.725-1.075 1.475t-.775 1.625q-.05.15-.175.25t-.3.1m0-2.825q.25-.425.55-.787t.575-.738q.35-.475.613-1.012T21.5 15.5q0-.825-.587-1.412T19.5 13.5t-1.412.588T17.5 15.5q0 .6.263 1.138t.612 1.012l.588.738q.287.363.537.787m0-2.425q-.525 0-.888-.363t-.362-.887t.363-.888t.887-.362t.888.363t.362.887t-.363.888t-.887.362"/></svg>
            LOCATION &nbsp;|&nbsp; <span style={{ color: '#EDE8E0', fontWeight: 400 }}>{profile?.location || '—'}</span>
          </div>
          <div style={styles.bioText}>
            <strong style={{ color: '#EDE8E0', fontWeight: 300 }}>BIO:</strong>{' '}
            {profile?.bio || 'No bio yet.'}
          </div>
          <div style={styles.bioFooter}>
            <span style={styles.bioJoined}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              Joined {profile?.created_at ? formatJoinDate(profile.created_at) : '—'}
            </span>
            <span style={styles.bioMore}>MORE</span>
          </div>
        </div>

        {/* STATS */}
        <div style={styles.statsWrap}>
          <div style={styles.stats}>
            {[
              { num: profile?.posts_count ?? 0, lbl: 'Posts' },
              { num: profile?.followers_count ?? 0, lbl: 'Followers' },
              { num: profile?.following_count ?? 0, lbl: 'Following' },
            ].map((s, i) => (
              <div key={s.lbl} style={statStyle(i)}>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <span style={styles.statNum}>{s.num}</span>
                </div>
                <div style={styles.statLbl}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PERSONAL INFORMATION + CONTACTS */}
        <div style={styles.infoContactsWrap}>
          {/* Header */}
          <div style={styles.infoContactsHeader}>
            <span style={{ color: '#B0C4D8', fontSize: 13, fontWeight: 300, letterSpacing: '0.08em', textTransform: 'uppercase' }}>PERSONAL INFORMATION</span>
            <svg version="1.1" viewBox="0 0 1024 1024" width="72" height="72" style={{ filter: 'drop-shadow(0px 6px 12px rgba(0,0,0,0.6))' }} xmlns="http://www.w3.org/2000/svg">
              <path transform="translate(292,67)" d="m0 0h421l29 1 21 3 23 6 24 10 19 11 14 10 13 11 16 16 13 17 10 16 10 21 8 24 3 14 2 18v492l-2 20-5 21-8 22-9 19-10 16-10 13-12 14-8 8-11 9-12 9-15 9-16 8-15 6-17 5-16 3-9 1-22 1h-453l-25-2-23-5-20-7-23-11-14-9-12-9-12-11-15-15-10-13-11-17-8-16-6-14-7-24-3-16-2-26v-475l3-26 6-22 6-16 8-16 8-14 10-13 9-11 17-17 17-13 14-9 19-10 21-8 15-4 16-3 12-1z" fill="#353638" stroke="#EDE8E0" strokeWidth="12"/>
              <path transform="translate(453,162)" d="m0 0h45v508l-1 21-10-1-13-3-37-1-13-1v2l16 4 20 4 37 5 1 3v81l-1 34-21-1-12-3-21-8-18-10-12-8-14-10-16-13-14-12-29-29-9-11-12-15-9-13-12-19-12-21-8-16-9-19-10-26-10-30-8-31-6-29-5-32-4-38-2-36v-49l2-31 4-31 5-22 5-15 8-16 8-10 5-6 14-11 19-10 27-9 28-6 35-5 32-3z" fill="#C9C8C8"/>
              <path transform="translate(686,188)" d="m0 0 11 2 21 9 9 6 11 9 11 16 6 13 6 21 4 25 2 17 2 29v55l-3 49-6 45-7 36-7 27-9 29-7 19-10 24-14 29-10 17-14 22-14 18-14 17-7 7-7 8-4 5-8 7-14 13-6 5h-2v2l-12 9-5 5-6 3-9 6-27 12-11 4-13 4-16 2h-18l-11-2-17-5-16-9-11-9-8-10-8-14-5-15-3-19v-11l3-24 5-20 7-19 8-18 11-20 13-20 8-11 11-14 10-11 7-8 14-15 10-9 15-13 18-14 21-14 15-9 19-10 23-9 22-6z"/>
              <path transform="translate(453,162)" d="m0 0h45v445l-2 3v-2l-11-1-8-4-4-8-1-6 1-12 1-3v-18l3-9 8-9 9-4 4-1h8l10 3 8 6 5 8 2 8v773h1263l-1-1263h-722l-83-1-10-5-7-9-3-7v-14l4-10 7-7 8-4z"/>
              <path transform="translate(351,812)" d="m0 0h10l10 4 8 7 5 10 1 9-2 10-17 56-9 30-14 46-22 73-18 59-12 40-17 56-19 63-11 36-12 40-20 66-17 56-14 47-19 62v4l31 9 185 56 165 50 59 18 70 21 165 50 56 17 36 11 60 18 142 43 119 36 112 34 8 2 9-29 15-46 9-29 21-66 18-57 11-33 4-6 7-6 7-3 7-1 12 2 9 6 6 8 3 10v7l-8 26-18 56-17 54-13 41-18 57-17 54-5 10-7 6-9 4h-14l-63-19-307-93-119-36-119-36-66-20-228-69-132-40-139-42-92-28-10-5-8-9-3-9v-9l4-15 29-96 24-79 19-63 17-56 16-53 22-73 10-33 14-46 13-43 24-80 9-29 14-46 12-40 7-21 6-8 9-6z"/>
            </svg>
          </div>

          {/* Body: 2-column grid */}
          <div style={{ ...styles.infoContactsBody }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

              {/* LEFT: Personal Info */}
              <div>
                {[
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
                    lbl: 'Occ.:',
                    val: profile?.occupation,
                  },
                  {
                    icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M2 21V9l8-6l5.4 4.05q-.6.075-1.162.288q-.563.212-1.063.562L10 5.5L4 10v9h4v2Zm8 0v-1.9q0-.525.262-.988q.263-.462.713-.737q1.15-.675 2.412-1.025Q14.65 16 16 16t2.613.35q1.262.35 2.412 1.025q.45.275.713.737q.262.463.262.988V21Zm2.15-2h7.7q-.875-.5-1.85-.75q-.975-.25-2-.25t-2 .25q-.975.25-1.85.75ZM16 15q-1.25 0-2.125-.875T13 12q0-1.25.875-2.125T16 9q1.25 0 2.125.875T19 12q0 1.25-.875 2.125T16 15Zm0-2q.425 0 .712-.288Q17 12.425 17 12t-.288-.713Q16.425 11 16 11t-.712.287Q15 11.575 15 12t.288.712Q15.575 13 16 13Z"/></svg>,
                    lbl: 'P.O.B:',
                    val: profile?.birthplace,
                  },
                  {
                    icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 14 14" fill="#EDE8E0"><g fill="none" stroke="#EDE8E0" strokeLinecap="round" strokeLinejoin="round"><path d="M12.91 5.5H1.09c-.56 0-.8-.61-.36-.9L6.64.73a.71.71 0 0 1 .72 0l5.91 3.87c.44.29.2.9-.36.9Z"/><rect x=".5" y="11" rx=".5"/><path d="M2 5.5V11m2.5-5.5V11M7 5.5V11m2.5-5.5V11M12 5.5V11"/></g></svg>,
                    lbl: 'Studies:',
                    val: profile?.studied_at,
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M18 5v6M4 5v6"/><path d="M18 5a4 4 0 0 0-4-4H10a4 4 0 0 0-4 4v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2z"/></svg>,
                    lbl: 'Went To:',
                    val: profile?.went_to,
                  },
                ].map(row => (
                  <div key={row.lbl} style={styles.infoRow}>
                    <span style={{ color: '#2A97DF', flexShrink: 0, display: 'flex' }}>{row.icon}</span>
                    <span style={styles.infoLbl}>{row.lbl}</span>
                    <span style={row.val ? styles.infoVal : styles.infoValEmpty}>{row.val || '—'}</span>
                  </div>
                ))}
              </div>

              {/* RIGHT: Contacts */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 300, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B0C4D8', textAlign: 'right', paddingRight: 7, padding: '10px 7px 8px 0', fontSize: 13 }}>CONTACTS</div>

                {/* X row */}
                <div style={styles.contactRow} onClick={e => e.stopPropagation()}>
                  <span
                    onClick={e => toggleDropdown('drop-x', e)}
                    style={{ display: 'inline-block', width: 7, height: 7, borderRight: '0.5px solid #ffffff', borderBottom: '0.5px solid #ffffff', transform: 'rotate(45deg) translateY(-2px)', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ color: '#EDE8E0', fontSize: 12, fontWeight: 300, letterSpacing: '0.03em', whiteSpace: 'nowrap', marginLeft: 5 }}>LINK</span>
                  <span style={{ flexShrink: 0, display: 'flex' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"><path fill="#EDE8E0" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584l-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
                  </span>
                  {openDropdown === 'drop-x' && (
                    <div style={styles.dropdown} onClick={e => e.stopPropagation()}>
                      <div style={styles.dropHeader}>
                        <span style={{ color: '#E74C3C' }}>RED PILL</span> OR <span style={{ color: '#2A97DF' }}>BLUE PILL</span>?
                        <span onClick={() => setOpenDropdown(null)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#8AAEC8', fontSize: 14, lineHeight: 1 }}>✕</span>
                      </div>
                      <div style={styles.dropContent}>
                        <span style={styles.dropVal}>{profile?.x_account ? `@${profile.x_account}` : '@—'}</span>
                        {profile?.x_account && (
                          <span onClick={() => copyText(`@${profile.x_account}`)} style={{ cursor: 'pointer', opacity: 0.6, flexShrink: 0, display: 'flex' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EDE8E0" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* EMAIL row */}
                <div style={styles.contactRow} onClick={e => e.stopPropagation()}>
                  <span
                    onClick={e => toggleDropdown('drop-email', e)}
                    style={{ display: 'inline-block', width: 7, height: 7, borderRight: '0.5px solid #ffffff', borderBottom: '0.5px solid #ffffff', transform: 'rotate(45deg) translateY(-2px)', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ color: '#4A7FA5', fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', whiteSpace: 'nowrap', marginLeft: 5 }}>EMAIL</span>
                  {openDropdown === 'drop-email' && (
                    <div style={styles.dropdown} onClick={e => e.stopPropagation()}>
                      <div style={styles.dropHeader}>
                        <span style={{ color: '#E74C3C' }}>RED PILL</span> OR <span style={{ color: '#2A97DF' }}>BLUE PILL</span>?
                        <span onClick={() => setOpenDropdown(null)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#8AAEC8', fontSize: 14, lineHeight: 1 }}>✕</span>
                      </div>
                      <div style={styles.dropContent}>
                        <span style={{ ...styles.dropVal, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>I humbly ask for forgiveness, fellow traveler! This information I share only with my inner circle. God bless you.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* PHONE row */}
                <div style={styles.contactRow} onClick={e => e.stopPropagation()}>
                  <span
                    onClick={e => toggleDropdown('drop-phone', e)}
                    style={{ display: 'inline-block', width: 7, height: 7, borderRight: '0.5px solid #ffffff', borderBottom: '0.5px solid #ffffff', transform: 'rotate(45deg) translateY(-2px)', flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ color: '#4A7FA5', fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', whiteSpace: 'nowrap', marginLeft: 5 }}>PHONE</span>
                  {openDropdown === 'drop-phone' && (
                    <div style={styles.dropdown} onClick={e => e.stopPropagation()}>
                      <div style={styles.dropHeader}>
                        <span style={{ color: '#E74C3C' }}>RED PILL</span> OR <span style={{ color: '#2A97DF' }}>BLUE PILL</span>?
                        <span onClick={() => setOpenDropdown(null)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#8AAEC8', fontSize: 14, lineHeight: 1 }}>✕</span>
                      </div>
                      <div style={styles.dropContent}>
                        <span style={{ ...styles.dropVal, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>I humbly ask for forgiveness, fellow traveler! This information I share only with my inner circle. God bless you.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ENGAGE / TABS */}
        <div style={styles.engageWrap}>
          <div style={styles.engageHeader}>Activity</div>
          <div style={styles.engageTabs}>
            {(['posts', 'replies', 'media'] as const).map((tab) => (
              <div key={tab} style={engageTabStyle(tab)} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>
          {activeTab === 'posts' && (
            posts.length === 0
              ? <div style={styles.tabEmpty}>NO POSTS YET</div>
              : posts.map(post => (
                <div key={post.id} style={{ padding: '12px 16px', borderTop: '0.5px solid #2A3648' }}>
                  <div style={{ fontSize: 13, color: '#B0C4D8' }}>{post.content}</div>
                  {post.image_url && <img src={post.image_url} alt="" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 2 }} />}
                  <div style={{ fontSize: 11, color: '#3C5268', marginTop: 6 }}>{new Date(post.created_at).toLocaleDateString()}</div>
                </div>
              ))
          )}
          {activeTab === 'replies' && <div style={styles.tabEmpty}>NO REPLIES YET</div>}
          {activeTab === 'media' && <div style={styles.tabEmpty}>NO MEDIA YET</div>}
        </div>

        <div style={{ height: 40 }} />
      </div>
    </MobileFrame>
  );
}