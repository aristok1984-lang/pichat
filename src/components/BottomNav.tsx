'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerHaptic } from '@/components/GestureSupport';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BottomNavProps {
  activeTab: 'chats' | 'feed' | 'calls' | 'contacts' | 'settings' | 'search' | 'reels' | 'notifications' | 'me' | 'ai' | 'profile';
}

// Chat icon — speech bubble, ultra-thin stroke
const ChatIcon = ({ isActive }: { isActive: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      stroke={isActive ? '#000000' : '#ffffff'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

// AI Assistant icon — exact uploaded SVG
const AIAssistantIcon = () => {
  return (
    <svg
      version="1.1"
      viewBox="0 0 1030 1113"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '85%', height: '85%', display: 'block' }}
    >
      <path transform="translate(0)" d="m0 0h1030v1113h-1030z"/>
      <path transform="translate(519,282)" d="m0 0h53l34 4 26 6 30 10 25 12 11 6 15 10 16 13 10 9 10 10 11 14 10 15 10 18 5 11 8 24 5 22 3 24v47l-3 25-8 32-8 20-8 16-8 13-9 12-12 13-12 10-16 10-17 8-20 6-7 1h-27l-15-3-15-6-13-10-8-10-8-16-2-5-10 13-11 11-14 9-17 8-17 5-10 2h-31l-21-5-18-8-14-9-15-14-7-8-9-15-8-19-5-25v-47l5-25 8-24 10-19 8-12 8-10 11-12 9-9 12-9 16-9 19-9 22-6 11-2h29l18 4 15 6 14 10 11 12 4 7 5-24 3-11h62l1 2-9 52-18 101-7 39-1 8v21l2 10 3 6 9 4 4 1h10l16-4 15-9 12-12 12-20 8-20 7-24 4-19 1-8v-52l-4-26-7-23-10-22-10-16-9-11-17-17-21-14-17-9-21-8-13-4-30-6-10-1h-53l-19 2-30 7-27 9-25 12-20 13-14 11-12 11-8 7-9 11-8 10-12 19-12 22-10 26-6 26-4 30v43l4 31 6 26 8 20 10 20 9 14 10 13 9 10 12 12 13 10 20 12 22 11 30 10 28 5 10 1h49l25-3 26-6 24-8 27-13 11-6 3 1 11 23 6 15-1 3-22 12-27 11-30 9-24 5-25 3h-54l-25-3-30-6-25-8-26-10-22-11-19-12-19-14-11-10-8-7-9-9-9-11-10-14-9-15-8-15-7-16-8-25-6-28-3-30v-29l3-32 7-34 11-32 14-28 11-18 14-19 13-15 19-19 14-11 12-9 15-10 22-12 21-10 28-10 21-6 25-5z" fill="#FDFDFD"/>
      <path transform="translate(506,29)" d="m0 0h11l14 2 16 5 24 13 19 11 49 28 26 15 24 14 22 13 26 15 27 16 23 13 22 13 26 15 25 15 14 8 55 33 11 7 13 12 9 13 7 14 4 13 2 12v458l-3 15-4 12-9 17-9 11-11 10-15 9-103 61-25 15-29 17-25 15-54 32-15 9-32 19-15 9-22 13-29 17-20 12-11 5-16 4h-27l-16-4-12-5-13-8-29-17-25-15-29-17-35-21-29-17-28-17-29-17-51-30-15-9-27-16-29-17-27-16-18-11-12-11-10-13-8-16-5-17-1-6v-461l3-15 6-16 8-13 11-13 10-8 22-13 55-33 27-16 78-46 29-17 27-16 49-29 26-15 22-13 29-17 21-12 16-5zm-3 31-15 4-10 5-25 15-82 48-49 29-51 30-87 51-28 17-22 13-25 15-12 11-7 10-5 12-3 16v446l3 15 5 12 8 11 10 9 26 15 68 40 51 30 28 17 29 17 40 24 32 19 15 9 22 13 28 17 16 9 25 15 12 4 5 1h19l12-3 12-6 45-27 29-17 25-15 32-19 50-30 27-16 40-24 44-26 61-36 17-10 11-9 9-13 5-12 2-9v-457l-3-13-7-14-9-11-10-7-32-19-25-15-53-31-19-11-29-17-26-15-41-24-45-26-24-14-70-40-16-9-15-4z" fill="#FDFDFD"/>
      <path transform="translate(528,449)" d="m0 0h22l16 4 13 8 10 10 8 16 3 12v43l-6 28-8 24-8 16-8 11-6 7-17 12-17 8-11 3h-26l-12-4-10-6-6-5-8-10-7-15-4-16v-43l5-23 8-20 9-16 11-14 12-12 15-10 12-5z"/>
    </svg>
  );
};

// Hubs icon — uploaded network hub SVG
const HubsIcon = ({ isActive }: { isActive: boolean }) => {
  const color = isActive ? '#000000' : '#ffffff';
  return (
    <svg width="20" height="20" viewBox="0 0 1848 1724" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m917 55h15l23 2 23 5 18 6 19 9 15 9 16 12 15 13 11 11 9 11 10 14 9 16 7 15 7 21 5 21 2 16v26l-3 22-6 21-8 21-11 20-13 18-12 14-18 18-15 11-13 8-17 9-25 9-21 5-11 2-1 23v186l28 3 29 5 32 8 32 11 25 11 21 10 22 13 17 12 13 10 16 13 20 18 12 13 10 10 11 14 14 18 10 15 11 19 8 16 10 22 12 34 8 30 4 20 3 28 1 21v16l-1 20-5 37-7 31-8 27-6 17-1 5 4 2 28 19 20 14 34 25 34 24 19 13 15 11 14 10 17 12 7-6 9-9 11-9 20-13 15-7 19-7 23-6 21-3 20-1 23 2 24 5 27 9 21 10 15 10 13 10 10 9 5 4 7 8 8 9 11 16 13 24 10 25 5 19 3 24v18l-3 23-6 24-10 25-9 17-11 16-11 12-7 8-7 7-11 9-14 10-14 8-21 10-27 9-21 4-8 1h-36l-27-4-21-6-16-7-20-10-12-8-13-10-12-11-11-12-11-14-7-10-7-12-10-25-6-21-4-26v-28l4-26 6-23 10-25 6-11v-2l-9-6-18-13-19-13-18-13-20-14-12-8-10-7-54-39-13-9-6-4-2 5-10 17-8 11-7 9-9 11-9 10-7 8-11 12-8 7-11 10-11 9-12 10-18 13-19 11-23 12-19 9-28 11-29 9-26 6-33 5-9 1h-62l-34-4-26-5-24-7-30-11-26-11-23-12-22-14-14-10-16-12-12-11-8-7-14-14-7-8-10-11-9-11-10-13-10-15-9-15-4-7-5 1-19 14-23 16-19 13-17 12-19 13-19 14-25 17-14 10-13 10-9 6 2 6 10 19 6 16 6 21 4 30v21l-3 23-6 22-9 22-9 17-12 17-13 15-11 12-9 8-18 13-18 10-21 9-22 7-26 5-13 1h-19l-18-2-19-4-22-7-21-9-19-11-14-10-11-10-5-4-7-8-11-13-13-19-9-16-7-17-7-25-3-21v-32l2-18 5-19 7-19 9-19 11-18 13-17 18-18 11-9 18-13 16-9 20-8 25-7 25-4h35l28 5 26 8 15 6 17 9 12 8 10 8 10 9 6 6 4-1 9-8 19-13 16-12 12-8 17-12 18-13 19-14 20-14 30-20 16-11 7-5h2l-2-9-10-30-8-33-5-31-2-24v-37l2-24 6-31 7-28 11-33 9-21 11-22 10-17 15-22 13-17 11-13 16-17 11-11 8-7 10-9 13-10 23-16 19-12 18-10 15-7 26-10 31-10 28-7 23-4 13-1h12v-211l-12-1-17-3-21-7-20-9-18-11-16-12-11-10-14-14-12-16-10-16-11-23-8-24-4-21-1-8v-30l3-21 4-15 5-15 11-24 9-16 8-11 9-11 7-8 8-7 16-13 17-11 18-10 20-8 25-6 16-2z"
        fill={color}
      />
      <path
        d="m909 876h37l29 4 30 7 29 11 21 10 22 12 21 13 21 16 14 12 10 9 11 9 13 13 8 7 29 29-1 4-9 7-12 11-9 9-8 7-13 12-11 9-11 10-17 13-18 13-19 12-23 12-28 12-35 10-18 3-26 2h-38l-33-4-20-5-33-11-24-11-20-11-15-10-18-13-13-10-14-12-10-9-11-9-17-16-15-14-9-9 2-4 50-50 8-7 10-10 11-9 16-13 13-9 13-8 18-10 25-12 28-10 26-7 24-4z"
        fill={isActive ? '#ffffff' : '#000000'}
      />
      <path
        d="m586 1038 9 3 20 9 12 7 13 11 12 11 8 7 11 11 8 7 11 10 14 11 15 12 13 10 21 14 15 9 22 12 27 12 34 11 24 5 25 4 11 1h30l21-2 34-6 25-7 24-8 27-12 25-14 16-11 18-13 13-11 11-9 11-10 11-9 17-16 8-7 10-9 11-9 18-13 8-4 17-4h3v12l-3 28-6 31-8 28-10 24-14 29-10 16-21 28-11 13-7 7-5 6-8 7-12 11-17 13-15 11-19 12-18 10-23 11-20 8-27 8-34 7-39 4h-34l-29-3-26-5-32-8-21-8-16-7-20-10-22-13-15-10-18-14-10-9-8-7-11-10-7-8-9-10-15-20-11-15-9-15-12-23-13-30-6-18-7-28-4-28-1-14z"
        fill={isActive ? '#ffffff' : '#000000'}
      />
      <path
        d="m906 693h40l35 4 25 5 37 12 26 11 25 12 18 11 20 14 13 11 11 9 15 14 9 9 7 8 13 16 13 18 14 23 9 16 12 28 8 26 6 24 4 25 3 29-7-1-17-7-12-8-13-11-15-14-29-29-8-7-13-12-14-11-17-13-17-12-18-11-23-12-15-7-21-8-29-9-26-6-33-4h-23l-24 2-36 7-24 7-27 11-22 10-19 10-15 9-19 14-13 10-16 13-11 10-8 7-23 23-5 6-18 18-10 8-13 8-26 11-5 1 4-40 4-23 6-23 10-27 11-25 9-17 15-24 11-15 13-16 9-11 14-14 11-9 10-9 20-15 17-11 18-10 25-12 26-10 29-8 25-5 22-3z"
        fill={isActive ? '#ffffff' : '#000000'}
      />
      <path
        d="m908 102h33l20 4 24 8 16 8 13 9 14 12 13 13 8 11 9 15 9 20 4 14 3 22v15l-2 20-4 18-8 21-10 17-7 9-9 10-12 12-17 13-25 13-19 6-20 4-7 1h-24l-21-3-27-9-22-12-16-12-16-16-11-15-8-14-7-15-8-27-2-21 1-23 4-20 6-16 8-16 9-14 14-17 7-7 14-11 16-10 17-8 21-6z"
        fill={color}
      />
      <path
        d="m218 1292h36l17 3 17 5 21 9 17 10 15 13 8 8 11 14 10 16 7 16 4 13 3 13 2 20v17l-2 18-5 17-9 21-12 19-12 14-7 7-17 13-19 11-13 6-13 5-20 4-7 1h-28l-21-3-27-9-22-12-16-12-16-16-11-15-8-14-7-15-8-27-2-21 1-23 4-20 6-16 8-16 9-14 14-17 7-7 14-11 16-10 17-8 21-6z"
        fill={color}
      />
      <path
        d="m1597 1292h35l17 3 20 6 18 8 17 10 14 12 9 9 11 14 10 15 10 22 5 16 3 23v18l-4 25-4 12-8 16-10 18-8 11-9 10-8 8-12 9-20 12-13 6-18 6-22 4h-29l-19-3-22-7-16-8-15-9-13-10-10-9-10-11-10-15-11-23-5-15-4-20v-28l3-20 6-20 8-18 10-16 11-14 14-14 11-8 17-10 20-8 18-5z"
        fill={color}
      />
      <path
        d="m918 933h19l16 4 12 5 13 7 14 11 10 10 7 10 6 12 6 21 1 5v19l-4 18-5 13-6 11-9 11-8 8-13 9-14 7-13 4-13 2h-16l-13-2-17-6-13-7-10-8-8-8-10-14-6-12-5-16-2-17v-14l3-16 6-17 9-14 9-10 9-8 11-7 13-6 14-4z"
        fill={color}
      />
      <path
        d="m919 988h9l8 4 12 12 5 8 2 6v10l-6 12-12 14-9 6-4 1h-8l-11-4-10-9-7-9-4-10v-9l4-8 9-10 8-7 8-5z"
        fill={isActive ? '#ffffff' : '#000000'}
      />
    </svg>
  );
};

// Feed icon — RSS/signal style
const FeedIcon = ({ isActive }: { isActive: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256">
    <path
      d="M104.08,151.92A67.52,67.52,0,0,1,124,200a4,4,0,0,1-8,0,60,60,0,0,0-60-60,4,4,0,0,1,0-8A67.52,67.52,0,0,1,104.08,151.92ZM56,84a4,4,0,0,0,0,8A108,108,0,0,1,164,200a4,4,0,0,0,8,0A116,116,0,0,0,56,84Zm116,0A162.92,162.92,0,0,0,56,36a4,4,0,0,0,0,8A155,155,0,0,1,166.31,89.69,155,155,0,0,1,212,200a4,4,0,0,0,8,0A162.92,162.92,0,0,0,172,84ZM60,188a8,8,0,1,0,8,8A8,8,0,0,0,60,188Z"
      fill={isActive ? '#000000' : '#ffffff'}
    />
  </svg>
);

// Reels icon — antenna/broadcast style
const ReelsIcon = ({ isActive }: { isActive: boolean }) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 33.7 33.7"
  >
    <g fill={isActive ? '#000000' : '#ffffff'}>
      <path d="M33.667,18.051c-2.646-6.921-9.404-11.57-16.816-11.57c-7.411,0-14.169,4.649-16.817,11.569
        c-0.099,0.258,0.03,0.547,0.288,0.646c0.257,0.1,0.547-0.029,0.646-0.287c0.263-0.688,0.578-1.348,0.924-1.984l3.884,2.238
        l0.499-0.867L2.396,15.56c0.609-0.982,1.312-1.896,2.099-2.727l3.164,3.162l0.707-0.707L5.2,12.125
        c0.838-0.786,1.758-1.48,2.735-2.084l2.231,3.864l0.866-0.5L8.802,9.541c1.008-0.544,2.067-0.993,3.171-1.328l1.16,4.324
        l0.492-0.133c-4.331,1.154-7.738,4.573-8.871,8.914c-0.099,0.382-0.606,0.769-1.201,1.163h4.276
        c-0.631-0.954-0.723-2.215-0.112-3.273c0.858-1.488,2.765-2,4.255-1.141c1.489,0.86,2,2.768,1.14,4.256
        c-0.033,0.059-0.078,0.104-0.114,0.158h7.709c-0.037-0.055-0.081-0.102-0.114-0.158c-0.861-1.488-0.353-3.396,1.139-4.256
        c1.489-0.857,3.396-0.349,4.255,1.141c0.61,1.06,0.519,2.319-0.113,3.273h4.203c-0.555-0.365-1.018-0.725-1.106-1.078
        c-0.856-3.384-3.094-6.218-6.076-7.867l0.64,0.369l2.23-3.866c0.977,0.604,1.896,1.296,2.734,2.083l-3.164,3.166l0.707,0.707
        l3.163-3.165c0.788,0.829,1.489,1.744,2.101,2.727l-3.879,2.241l0.5,0.864l3.883-2.244c0.347,0.64,0.663,1.3,0.927,1.99
        c0.076,0.199,0.266,0.321,0.467,0.321c0.061,0,0.12-0.011,0.179-0.032C33.638,18.598,33.767,18.309,33.667,18.051z M12.937,7.947
        c1.107-0.266,2.252-0.411,3.414-0.446v4.48h0.5h0.5v-4.48c1.16,0.035,2.303,0.18,3.41,0.445l-1.159,4.332l0.352,0.094
        c-0.993-0.253-2.031-0.391-3.103-0.391c-1.072,0-2.112,0.137-3.105,0.391l0.354-0.095L12.937,7.947z M16.851,20.163
        c-1.721,0-3.115-1.395-3.115-3.114c0-1.72,1.395-3.114,3.115-3.114c1.72,0,3.115,1.395,3.115,3.114
        C19.964,18.769,18.57,20.163,16.851,20.163z M22.665,13.405l0.224,0.129c-0.869-0.48-1.804-0.857-2.783-1.121l0.461,0.123
        l1.157-4.324c1.104,0.334,2.165,0.782,3.173,1.327L22.665,13.405z"/>
      <path d="M16.851,25.543c3.5-1,7.188-2.625,7.188-2.625H8.601c0,0,5.963,0.375,8.213,1.25
        c1.125,0.438-2.416,1.207-3.463,2.125c-1.047,0.916,4.75,1.375,8.024,0.312C16.013,26.606,15.54,25.917,16.851,25.543z"/>
    </g>
  </svg>
);

// Search icon — magnifying glass, ultra-thin stroke
const SearchIcon = ({ isActive }: { isActive: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="11"
      cy="11"
      r="7"
      stroke={isActive ? '#000000' : '#ffffff'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="16.5"
      y1="16.5"
      x2="22"
      y2="22"
      stroke={isActive ? '#000000' : '#ffffff'}
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

// Me icon — person silhouette, ultra-thin stroke
const MeIcon = ({ isActive }: { isActive: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="12"
      cy="8"
      r="4"
      stroke={isActive ? '#000000' : '#ffffff'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
      stroke={isActive ? '#000000' : '#ffffff'}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NAV_ITEMS = [
  {
    id: 'chats' as const,
    label: 'Chats',
    href: '/chats-screen',
  },
  {
    id: 'ai' as const,
    label: 'AI',
    href: '/chats-screen',
  },
  {
    id: 'contacts' as const,
    label: 'Hubs',
    href: '/communities',
  },
  {
    id: 'feed' as const,
    label: 'Feed',
    href: '/social-feed',
  },
  {
    id: 'reels' as const,
    label: 'Reels',
    href: '/reels',
  },
  {
    id: 'search' as const,
    label: 'Search',
    href: '/search',
  },
  {
    id: 'me' as const,
    label: 'Me',
    href: '/profile',
  },
];

function NavIcon({ id, isActive }: { id: string; isActive: boolean }) {
  switch (id) {
    case 'chats': return <ChatIcon isActive={isActive} />;
    case 'ai': return <AIAssistantIcon />;
    case 'contacts': return <HubsIcon isActive={isActive} />;
    case 'feed': return <FeedIcon isActive={isActive} />;
    case 'reels': return <ReelsIcon isActive={isActive} />;
    case 'search': return <SearchIcon isActive={isActive} />;
    case 'me': return <MeIcon isActive={isActive} />;
    default: return null;
  }
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    // Fetch initial unread count
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadNotifCount(count || 0));

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`bottomnav_notifs:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', user.id)
            .eq('is_read', false)
            .then(({ count }) => setUnreadNotifCount(count || 0));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  function handleNavClick(href: string) {
    triggerHaptic('selection');
    router.push(href);
  }

  // Map nav item ids to activeTab values
  const tabMap: Record<string, string> = {
    chats: 'chats',
    ai: 'ai',
    contacts: 'contacts',
    feed: 'feed',
    reels: 'reels',
    search: 'search',
    me: 'me',
  };

  // Normalize incoming activeTab to nav item id
  const normalizedTab = (() => {
    switch (activeTab) {
      case 'profile': return 'me';
      case 'notifications': return 'chats';
      case 'settings': return 'me';
      case 'calls': return 'chats';
      default: return activeTab;
    }
  })();

  return (
    <nav
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        background: '#17212B',
        borderTop: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '80px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: '4px',
        paddingRight: '4px',
        zIndex: 20,
        boxSizing: 'border-box',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === normalizedTab;
        return (
          <button
            key={`nav-${item.id}`}
            onClick={() => handleNavClick(item.href)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flex: 1,
              height: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              padding: '0 2px',
              position: 'relative',
            }}
          >
            {/* Icon container */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '35px',
                height: '30px',
                borderRadius: '2px',
                background: item.id === 'ai' ? '#000000' : (isActive ? '#ffffff' : '#000000'),
                transition: 'background 0.2s ease',
                flexShrink: 0,
                boxSizing: 'border-box',
                overflow: 'hidden',
                padding: '0',
                position: 'relative',
              }}
            >
              <NavIcon id={item.id} isActive={isActive} />
              {/* Unread badge on chats icon */}
              {item.id === 'chats' && unreadNotifCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#EF4444',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    minWidth: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                    zIndex: 10,
                  }}
                >
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </span>

            {/* Label */}
            <span
              style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '10px',
                fontWeight: 300,
                letterSpacing: '0.3px',
                color: '#ffffff',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                transition: 'opacity 0.2s ease',
                opacity: isActive ? 1 : 0.6,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
