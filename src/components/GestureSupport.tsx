'use client';

import React, { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SwipeBackProps {
  children: React.ReactNode;
  onBack?: () => void;
  threshold?: number;
}

/**
 * Wraps content with swipe-back gesture support.
 * Swipe right from left edge to go back.
 */
export function SwipeBack({ children, onBack, threshold = 80 }: SwipeBackProps) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const isDraggingRef = useRef(false);
  // Track whether a drag has ever started — only apply snap-back transition after a real drag
  const hasDraggedRef = useRef(false);
  const router = useRouter();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    // Only trigger if starting from left edge (first 30px)
    if (touch.clientX > 30) return;
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || startXRef.current === null || startYRef.current === null) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = Math.abs(touch.clientY - startYRef.current);

    // Cancel if more vertical than horizontal
    if (dy > Math.abs(dx)) {
      isDraggingRef.current = false;
      setDragX(0);
      return;
    }

    if (dx > 0) {
      hasDraggedRef.current = true;
      setDragX(Math.min(dx, 150));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (dragX >= threshold) {
      triggerHaptic('medium');
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    }
    setDragX(0);
    startXRef.current = null;
    startYRef.current = null;
  }, [dragX, threshold, onBack, router]);

  const progress = Math.min(dragX / threshold, 1);

  return (
    <div
      className="relative w-full h-full flex flex-col flex-1 min-h-0"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dragX > 0 ? `translateX(${dragX * 0.4}px)` : 'translateX(0)',
        // Only apply snap-back transition after an actual drag — never on initial mount
        transition: dragX === 0 && hasDraggedRef.current ? 'transform 0.2s ease' : 'none',
      }}
    >
      {/* Swipe indicator */}
      {dragX > 10 && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `rgba(42,171,238,${progress * 0.8})`,
            opacity: progress,
            transform: `translateY(-50%) scale(${0.6 + progress * 0.4})`,
            transition: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Trigger haptic feedback on supported devices.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' = 'light') {
  if (typeof window === 'undefined') return;
  // iOS Safari Haptic Feedback via vibration API
  if ('vibrate' in navigator) {
    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 40,
      selection: [5, 5],
    };
    navigator.vibrate(patterns[type]);
  }
}

/**
 * Hook to add haptic feedback to any interaction.
 */
export function useHaptic() {
  return {
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    selection: () => triggerHaptic('selection'),
  };
}
