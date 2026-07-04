'use client';

import React, { memo, useMemo } from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  onClick?: () => void;
  /** variant kept for API compatibility — both render the same official logo */
  variant?: 'full' | 'pi';
}

const AppLogo = memo(function AppLogo({
  size = 64,
  className = '',
  onClick,
}: AppLogoProps) {
  const containerClassName = useMemo(() => {
    const classes = ['flex items-center justify-center'];
    if (onClick) classes.push('cursor-pointer hover:opacity-80 transition-opacity');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [onClick, className]);

  return (
    <div
      className={containerClassName}
      onClick={onClick}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="-94 -94 188 188"
        style={{ display: 'block', flexShrink: 0 }}
        aria-label="PiChat icon"
        role="img"
      >
        <rect x="-94" y="-94" width="188" height="188" fill="#07111F"/>
        <rect x="-90" y="-90"
          width="180"
          height="180"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
          shapeRendering="geometricPrecision"/>
        <circle cx="0"
          cy="0"
          r="82"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          shapeRendering="geometricPrecision"/>
        <g fill="#FFFFFF" shapeRendering="crispEdges">
          <rect x="-30" y="-45" width="60" height="7"/>
          <rect x="-30" y="-45" width="7" height="90"/>
          <rect x="23" y="-45" width="7" height="90"/>
        </g>
      </svg>
    </div>
  );
});

export default AppLogo;
