import React from 'react';

interface MobileFrameProps {
  children: React.ReactNode;
}

export default function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="w-full flex justify-center">
      {/* Phone frame — visible on md+ */}
      <div className="hidden md:block phone-frame relative">
        <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[44px]">
          {children}
        </div>
      </div>

      {/* Full screen on mobile */}
      <div
        className="md:hidden w-full min-h-screen flex flex-col overflow-hidden relative"
        style={{ background: 'var(--background)' }}
      >
        {children}
      </div>
    </div>
  );
}