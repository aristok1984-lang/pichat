'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

type AdminSection =
  | 'dashboard' |'users' |'content' |'reports' |'communities' |'verification' |'roles' |'settings';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  activeSection: AdminSection;
}

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',          icon: '📊', href: '/admin' },
  { id: 'users',        label: 'User Management',    icon: '👥', href: '/admin/users' },
  { id: 'communities',  label: 'Communities',        icon: '🏘️', href: '/admin/communities' },
  { id: 'reports',      label: 'Reports',            icon: '🚨', href: '/admin/reports' },
  { id: 'verification', label: 'Verification',       icon: '✅', href: '/admin/verification' },
  { id: 'roles',        label: 'Roles & Permissions',icon: '🔑', href: '/admin/roles' },
  { id: 'content',      label: 'Content Moderation', icon: '🛡️', href: '/admin/content' },
  { id: 'settings',     label: 'System Settings',    icon: '⚙️', href: '/admin/settings' },
];

export default function AdminLayout({ children, title, activeSection }: AdminLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex-col py-6 px-3 hidden md:flex"
        style={{
          background: 'var(--secondary)',
          borderRight: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            π
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>PiChat</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left"
                style={{
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--muted-foreground)',
                  borderRadius: '2px',
                }}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to App */}
        <button
          onClick={() => router.push('/social-feed')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all mt-4"
          style={{ color: 'var(--muted-foreground)', borderRadius: '2px' }}
        >
          <span>←</span>
          <span>Back to App</span>
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}
        >
          {/* Mobile nav */}
          <div className="flex items-center gap-2 md:hidden overflow-x-auto">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'var(--primary)', color: '#fff', borderRadius: '2px' }}
            >
              π
            </div>
            <div className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(item.href)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all flex-shrink-0"
                  style={{
                    background: item.id === activeSection ? 'var(--primary)' : 'var(--muted)',
                    borderRadius: '2px',
                  }}
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-lg font-bold hidden md:block" style={{ color: 'var(--foreground)' }}>
            {title}
          </h1>

          <div className="flex items-center gap-2 ml-auto">
            <span
              className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(42,151,223,0.15)', color: 'var(--primary)', borderRadius: '2px' }}
            >
              Admin
            </span>
            <button
              onClick={() => router.push('/social-feed')}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hidden md:block"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '2px' }}
            >
              ← App
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <h1 className="text-xl font-bold mb-4 md:hidden" style={{ color: 'var(--foreground)' }}>
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
