'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const SocialFeedScreen = dynamic(() => import('./components/SocialFeedScreen'), {
  ssr: false,
});

export default function SocialFeedPage() {
  return <SocialFeedScreen />;
}