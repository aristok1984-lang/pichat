'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToPush } from '@/lib/push/vapid';

export default function PWARegister() {
  const { user } = useAuth();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker?.register('/sw.js')?.then((reg) => {
      navigator.serviceWorker?.addEventListener('message', (_event) => {
        // Push notifications handled silently
      });
    })?.catch(() => {
      // SW registration failed silently
    });
  }, []);

  // Subscribe to push once the user is authenticated
  useEffect(() => {
    if (!user) return;
    subscribeToPush();
  }, [user]);

  return null;
}
