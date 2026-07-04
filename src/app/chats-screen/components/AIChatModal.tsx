'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/lib/hooks/useChat';
import toast from 'react-hot-toast';

// ── Design tokens (mirror ChatDetail) ─────────────────────────────────────────
const BG            = '#0E1621';
const HEADER_BG     = '#17212B';
const INCOMING_BG   = '#242F3D';
const INCOMING_BORDER = 'rgba(42,58,74,0.80)';
const OUTGOING_CORE = '#2A97DF';
const OUTGOING_BG   = '#1A7FBF';
const OUTGOING_BORDER = 'rgba(42,151,223,0.55)';
const OUTGOING_SHADOW = '#1A6FA8';
const COMPOSER_BG   = '#17212B';
const COMPOSER_BORDER = 'rgba(42,58,74,0.80)';
const DIVIDER       = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY  = '#E8EDF2';
const TEXT_MUTED    = '#7C8FA3';
const PICHAT_BLUE   = '#2A97DF';

const DOT_BG_STYLE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(190,230,255,0.035) 0.5px, transparent 0.5px)',
  backgroundSize: '7px 7px',
  backgroundRepeat: 'repeat',
};

interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatModalProps {
  onClose: () => void;
  contextName?: string;
}

const SYSTEM_MESSAGE = {
  role: 'system' as const,
  content:
    'You are a helpful AI assistant integrated into PiChat, a messaging app. Be concise, friendly, and helpful. Keep responses short and conversational.',
};

export default function AIChatModal({ onClose, contextName }: AIChatModalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<AIChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { response, isLoading, error, sendMessage } = useChat('OPEN_AI', 'gpt-5.4', true);

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  // Append streamed assistant response to history when done
  const prevIsLoading = useRef(false);
  useEffect(() => {
    if (prevIsLoading.current && !isLoading && response) {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: response }];
        }
        return [...prev, { role: 'assistant', content: response }];
      });
    }
    prevIsLoading.current = isLoading;
  }, [isLoading, response]);

  // Live-update the last assistant bubble while streaming
  useEffect(() => {
    if (isLoading && response) {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: response }];
        }
        return [...prev, { role: 'assistant', content: response }];
      });
    }
  }, [response, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: AIChatMessage = { role: 'user', content: text };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInput('');

    const apiMessages = [
      SYSTEM_MESSAGE,
      ...newHistory.map((m) => ({ role: m.role, content: m.content })),
    ];

    sendMessage(apiMessages, { max_completion_tokens: 512 });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ background: BG, ...DOT_BG_STYLE }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-3 py-3 shrink-0"
        style={{
          background: HEADER_BG,
          borderBottom: `1px solid ${DIVIDER}`,
        }}
      >
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center justify-center transition-colors"
          style={{ color: TEXT_MUTED, padding: '4px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        {/* Π Avatar */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: PICHAT_BLUE,
            border: '0.6px solid rgba(82,197,252,0.7)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 64 64" role="img" aria-label="PiChat AI">
            <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
              fill="none" stroke="#FFFFFF" strokeWidth="5"
              strokeLinecap="square" strokeLinejoin="miter"/>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: TEXT_PRIMARY }}>PiChat AI</p>
          <p className="text-xs" style={{ color: TEXT_MUTED }}>
            {contextName ? `In conversation with ${contextName}` : 'Powered by OpenAI'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-8">
            <div
              className="flex items-center justify-center"
              style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: PICHAT_BLUE,
                border: '0.6px solid rgba(82,197,252,0.7)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 64 64">
                <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                  fill="none" stroke="#FFFFFF" strokeWidth="5"
                  strokeLinecap="square" strokeLinejoin="miter"/>
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>Ask me anything</p>
            <p className="text-xs text-center px-8 leading-relaxed" style={{ color: TEXT_MUTED }}>
              I&apos;m your PiChat AI assistant. Ask questions, get suggestions, or just chat!
            </p>
          </div>
        )}

        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: PICHAT_BLUE,
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64">
                  <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                    fill="none" stroke="#FFFFFF" strokeWidth="6"
                    strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </div>
            )}
            <div
              className="max-w-[75%] px-3.5 py-2.5"
              style={msg.role === 'user' ? {
                background: `linear-gradient(145deg, rgba(42,171,238,0.15), ${OUTGOING_CORE})`,
                backgroundColor: OUTGOING_CORE,
                border: `0.7px solid ${OUTGOING_BORDER}`,
                borderRadius: '18px 18px 2px 18px',
                boxShadow: `0 2px 16px ${OUTGOING_SHADOW}30`,
              } : {
                background: INCOMING_BG,
                border: `0.7px solid ${INCOMING_BORDER}`,
                borderRadius: '18px 18px 18px 2px',
              }}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.97)' : TEXT_PRIMARY }}
              >
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && history[history.length - 1]?.role !== 'assistant' && (
          <div className="flex items-end gap-2">
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: '28px', height: '28px', borderRadius: '50%', background: PICHAT_BLUE }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64">
                <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                  fill="none" stroke="#FFFFFF" strokeWidth="6"
                  strokeLinecap="square" strokeLinejoin="miter"/>
              </svg>
            </div>
            <div
              className="px-4 py-3 flex items-center gap-1"
              style={{
                background: INCOMING_BG,
                border: `0.7px solid ${INCOMING_BORDER}`,
                borderRadius: '18px 18px 18px 2px',
              }}
            >
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div
        className="flex items-end gap-2 px-3 py-3 shrink-0"
        style={{
          background: COMPOSER_BG,
          borderTop: `1px solid ${COMPOSER_BORDER}`,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI…"
          rows={1}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-2xl text-sm resize-none outline-none leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: TEXT_PRIMARY,
            border: `1px solid ${DIVIDER}`,
            caretColor: OUTGOING_BG,
            maxHeight: '100px',
            opacity: isLoading ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center shrink-0 transition-all active:scale-95"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: input.trim() && !isLoading ? OUTGOING_BG : 'rgba(255,255,255,0.06)',
            color: input.trim() && !isLoading ? '#FFFFFF' : TEXT_MUTED,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
