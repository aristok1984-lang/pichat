'use client';

import React, { Suspense } from 'react';
import AdminUsersInner from './AdminUsersInner';

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <AdminUsersInner />
    </Suspense>
  );
}
