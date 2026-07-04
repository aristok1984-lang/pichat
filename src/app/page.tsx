'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SignUpLoginScreen from './sign-up-login-screen/page';
import SplashScreen from '@/components/SplashScreen';

export default function HomePage() {
  const [splashDone, setSplashDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user && splashDone) {
      router?.replace('/social-feed');
    }
  }, [user, loading, splashDone, router]);

  return (
    <>
      {mounted && !splashDone &&
        createPortal(
          <SplashScreen onFinish={() => setSplashDone(true)} />,
          document.body
        )
      }
      <div style={{ visibility: splashDone ? 'visible' : 'hidden' }}>
        {!loading && !user && <SignUpLoginScreen />}
      </div>
    </>
  );
}