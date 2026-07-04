'use client';

import React, { Suspense } from 'react';
import FollowersScreen from './FollowersScreen';

export default function FollowersPage() {
  return (
    <Suspense fallback={null}>
      <FollowersScreen />
    </Suspense>
  );
}
