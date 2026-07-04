'use client';

import React, { useEffect, useRef } from 'react';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '🎉'];

const PICKER_BG = '#17212B';
const PICKER_BORDER = 'rgba(42,58,74,0.90)';

interface EmojiReactionPickerProps {
  isSelf: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiReactionPicker({ isSelf, onSelect, onClose }: EmojiReactionPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Small delay so the same click that opened the picker doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`flex items-center gap-1 px-2 py-1.5 rounded-full ${isSelf ? 'self-end' : 'self-start'}`}
      style={{
        background: PICKER_BG,
        border: `0.7px solid ${PICKER_BORDER}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 50,
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-transform hover:scale-125 active:scale-110"
          style={{ fontSize: '20px', lineHeight: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
