'use client';

import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import AppLogo from '@/components/ui/AppLogo';

export default function AuthScreen() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4">
      {/* Desktop: centered phone frame */}
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AppLogo size={48} />
            <span className="text-3xl font-extrabold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-logo)' }}>
              PiChat
            </span>
          </div>
          <p className="text-muted-foreground font-medium" style={{ fontSize: '13px' }}>
            GATEWAY TO KNOWLEDGE
          </p>
        </div>

        {/* Card */}
        <div
          className="border border-border overflow-hidden animate-scale-in"
          style={{ background: 'var(--card)', borderRadius: '2px' }}
        >
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'login' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{ fontSize: '15px' }}
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-4 font-semibold transition-all duration-200 ${
                activeTab === 'signup' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{ fontSize: '15px' }}
            >
              Create Account
            </button>
          </div>

          {/* Form area */}
          <div
            className="p-6"
            key={activeTab}
            style={{ animation: 'tabFadeIn 0.2s ease forwards' }}
          >
            {activeTab === 'login' ? (
              <LoginForm onSwitchToSignup={() => setActiveTab('signup')} />
            ) : (
              <SignUpForm onSwitchToLogin={() => setActiveTab('login')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}