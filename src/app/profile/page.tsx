'use client';

import React, { useState, useEffect } from 'react';






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
  return null;
}