import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div
      className="w-full min-h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--background)' }}
    >
      {children}
    </div>
  );
}