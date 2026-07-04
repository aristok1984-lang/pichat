'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatItem } from './ChatsScreen';
import AppImage from '@/components/ui/AppImage';
import MediaUpload, { MediaPreview, MediaBubble, UploadedMedia } from '@/components/MediaUpload';
import EmojiReactionPicker from './EmojiReactionPicker';
import { useChat } from '@/lib/hooks/useChat';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#0E1621';                          // PiChat dark navy background
const HEADER_BG = '#17212B';                   // PiChat secondary/header
const INCOMING_BG = '#242F3C';                 // PiChat muted — incoming bubble
const INCOMING_BORDER = 'rgba(42,58,74,0.80)';
const OUTGOING_GRADIENT_START = '#2A97DF';     // Primary blue per spec
const OUTGOING_GRADIENT_END = '#52C5FC';       // Gradient end per spec
const OUTGOING_CORE = '#2A97DF';
const OUTGOING_BG = '#1A8FCC';                 // slightly deeper outgoing bg
const OUTGOING_HIGHLIGHT = '#52C5FC';
const OUTGOING_BORDER = 'rgba(42,171,238,0.45)';
const OUTGOING_SHADOW = '#1A6FA8';
const COMPOSER_BG = '#17212B';                 // original PiChat secondary
const COMPOSER_BORDER = 'rgba(42,58,74,0.80)';
const DATE_SEP_BG = 'rgba(23,33,43,0.85)';
const DATE_SEP_BORDER = 'rgba(42,58,74,0.60)';
const ACTION_MENU_BG = '#17212B';              // original PiChat card/secondary
const ACTION_MENU_BORDER = 'rgba(42,58,74,0.80)';
const DIVIDER = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY = '#FFFFFF';                // original PiChat foreground
const TEXT_SECONDARY = '#D7DDE5';
const TEXT_MUTED = '#7C8FA3';                  // original PiChat muted-foreground
const DELETE_RED = '#EF4444';                  // original PiChat danger
const META_COLOR = '#D7DDE5';                  // original PiChat muted-foreground for metadata
const PICHAT_BLUE = '#52C5FC';
const SEEN_COLOR = '#52C5FC';
const READ_RECEIPT_COLOR = '#52C5FC';

// 7-hour expiration window in seconds
const EXPIRATION_WINDOW_SECONDS = 7 * 3600;

// ── Background signature: 0.5px dots, #D7DDE5 @ 100% opacity, 7×7px perfect grid ──
const DOT_BG_STYLE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, #D7DDE5 0.25px, transparent 0.25px)',
  backgroundSize: '7px 7px',
  backgroundRepeat: 'repeat',
};

interface ChatDetailProps {
  chat: ChatItem;
  onBack: () => void;
  currentUserId?: string;
}

interface Message {
  id: string;
  text: string;
  time: string;
  isSelf: boolean;
  status?: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  mediaType?: string;
  reactions?: Record<string, string[]>;
  deleteTimer?: number;
  createdAt?: string;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Filter out expired messages before rendering
function filterExpiredMessages(messages: Message[]): Message[] {
  const now = Date.now();
  return messages.filter((m) => {
    if (!m.createdAt) return true;
    const createdMs = new Date(m.createdAt).getTime();
    const elapsed = (now - createdMs) / 1000;
    return elapsed < EXPIRATION_WINDOW_SECONDS;
  });
}

// ── Block/Report Modal ────────────────────────────────────────────────────────
const REPORT_REASONS = [
  'Spam or unwanted messages',
  'Harassment or bullying',
  'Hate speech or discrimination',
  'Threats or violence',
  'Sharing inappropriate content',
  'Impersonation',
  'Other',
];

function BlockReportModal({
  chatName,
  targetUserId,
  currentUserId,
  onClose,
}: {
  chatName: string;
  targetUserId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'menu' | 'report' | 'block-confirm' | 'done'>('menu');
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const supabase = createClient();

  async function handleBlock() {
    setLoading(true);
    try {
      await supabase.from('user_blocks').upsert({
        blocker_id: currentUserId,
        blocked_id: targetUserId,
      }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
      setDoneMsg(`${chatName} has been blocked. They can no longer message you.`);
      setMode('done');
    } catch {
      setDoneMsg('Something went wrong. Please try again.');
      setMode('done');
    } finally {
      setLoading(false);
    }
  }

  async function handleReport() {
    if (!selectedReason) return;
    setLoading(true);
    try {
      await supabase.from('content_reports').insert({
        reporter_id: currentUserId,
        reported_user_id: targetUserId,
        reason: selectedReason,
        details: details.trim(),
      });
      setDoneMsg('Report submitted. Our team will review it shortly.');
      setMode('done');
    } catch {
      setDoneMsg('Something went wrong. Please try again.');
      setMode('done');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden"
        style={{ background: ACTION_MENU_BG, border: `1px solid ${ACTION_MENU_BORDER}`, backdropFilter: 'blur(20px)' }}>
        {mode === 'menu' && (
          <>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              <h3 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>{chatName}</h3>
              <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>What would you like to do?</p>
            </div>
            <div className="p-3 space-y-1">
              <button onClick={() => setMode('report')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors hover:bg-white/5"
                style={{ color: TEXT_PRIMARY }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                Report {chatName}
              </button>
              <button onClick={() => setMode('block-confirm')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors hover:bg-red-500/10"
                style={{ color: DELETE_RED }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                Block {chatName}
              </button>
            </div>
            <div className="px-3 pb-4">
              <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY }}>Cancel</button>
            </div>
          </>
        )}
        {mode === 'block-confirm' && (
          <>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>Block {chatName}?</h3>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: TEXT_MUTED }}>
                They won&apos;t be able to message you or see your profile. You can unblock them anytime from Settings.
              </p>
            </div>
            <div className="px-3 pb-4 space-y-2">
              <button onClick={handleBlock} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
                style={{ background: '#c0392b', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Blocking…' : `Block ${chatName}`}
              </button>
              <button onClick={() => setMode('menu')} className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY }}>Cancel</button>
            </div>
          </>
        )}
        {mode === 'report' && (
          <>
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
              <h3 className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>Report {chatName}</h3>
              <p className="text-xs mt-0.5" style={{ color: TEXT_MUTED }}>Select a reason</p>
            </div>
            <div className="px-3 py-2 max-h-64 overflow-y-auto">
              {REPORT_REASONS.map(reason => (
                <button key={reason} onClick={() => setSelectedReason(reason)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
                  style={{ color: TEXT_PRIMARY, background: selectedReason === reason ? 'rgba(37,99,168,0.2)' : 'transparent' }}>
                  <span>{reason}</span>
                  {selectedReason === reason && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={OUTGOING_BG} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {selectedReason && (
              <div className="px-3 pb-2">
                <textarea value={details} onChange={e => setDetails(e.target.value)}
                  placeholder="Additional details (optional)" rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                  style={{ background: 'rgba(255,255,255,0.05)', color: TEXT_PRIMARY, border: `1px solid ${DIVIDER}` }} />
              </div>
            )}
            <div className="px-3 pb-4 space-y-2">
              <button onClick={handleReport} disabled={!selectedReason || loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
                style={{ background: OUTGOING_BG, opacity: !selectedReason || loading ? 0.5 : 1 }}>
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
              <button onClick={() => setMode('menu')} className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY }}>Back</button>
            </div>
          </>
        )}
        {mode === 'done' && (
          <div className="px-5 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(37,99,168,0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={OUTGOING_BG} strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: TEXT_PRIMARY }}>{doneMsg}</p>
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: OUTGOING_BG }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Call Overlay ──────────────────────────────────────────────────────────────
function CallOverlay({ chat, onEnd }: { chat: ChatItem; onEnd: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between py-16 px-6"
      style={{ background: 'linear-gradient(160deg, #0a1020 0%, #101830 50%, #142048 100%)' }}>
      <div className="flex flex-col items-center gap-4 mt-8">
        <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center text-4xl font-bold text-white"
          style={{ background: chat.avatarColor, boxShadow: `0 0 40px ${OUTGOING_BG}40` }}>
          {chat.avatar ? (
            <AppImage src={chat.avatar} alt={chat.name} width={112} height={112} className="w-full h-full object-cover" />
          ) : <span>{chat.name.charAt(0)}</span>}
        </div>
        <p className="text-white text-2xl font-bold">{chat.name}</p>
        <p className="text-sm" style={{ color: TEXT_MUTED }}>{fmt(seconds)}</p>
      </div>
      <div className="flex items-center gap-8">
        <button onClick={() => setMuted(m => !m)} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
            style={{ background: muted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              {muted ? (
                <><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" /><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></>
              ) : (
                <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></>
              )}
            </svg>
          </div>
          <span className="text-xs" style={{ color: TEXT_MUTED }}>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button onClick={onEnd} className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-600">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M23.71 16.67C20.66 13.78 16.54 12 12 12 7.46 12 3.34 13.78.29 16.67c-.18.18-.29.43-.29.71 0 .28.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.48 3-.73 4.6-.73 1.6 0 3.15.25 4.6.72v3.1c0 .39.23.74.56.9.98.49 1.87 1.12 2.67 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71 0-.28-.11-.53-.29-.71z" />
            </svg>
          </div>
          <span className="text-xs" style={{ color: TEXT_MUTED }}>End</span>
        </button>
        <button onClick={() => setSpeakerOn(s => !s)} className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full flex items-center justify-center transition-colors"
            style={{ background: speakerOn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {speakerOn ? (
                <><path d="M19.07 4.93a10 10 0 010 14.14" /><path d="M15.54 8.46a5 5 0 010 7.07" /></>
              ) : <line x1="23" y1="9" x2="17" y2="15" />}
            </svg>
          </div>
          <span className="text-xs" style={{ color: TEXT_MUTED }}>{speakerOn ? 'Speaker' : 'Earpiece'}</span>
        </button>
      </div>
    </div>
  );
}

// ── More Menu ─────────────────────────────────────────────────────────────────
function MoreMenu({ onClose, onClearChat, onBlockReport, chatName }: {
  onClose: () => void; onClearChat: () => void; onBlockReport: () => void; chatName: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={menuRef} className="absolute top-12 right-2 z-40 overflow-hidden min-w-[180px]"
      style={{ background: ACTION_MENU_BG, border: `1px solid ${ACTION_MENU_BORDER}`, borderRadius: '12px', backdropFilter: 'blur(24px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <button onClick={() => { onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
        style={{ color: TEXT_PRIMARY }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
        View Profile
      </button>
      <button onClick={() => { onClearChat(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
        style={{ color: TEXT_PRIMARY }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
        Clear Chat
      </button>
      <div style={{ height: '1px', background: DIVIDER }} />
      <button onClick={() => { onBlockReport(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-red-500/10"
        style={{ color: DELETE_RED }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        Block / Report
      </button>
    </div>
  );
}

// ── Message Action Menu (long-press) ──────────────────────────────────────────
function MessageActionMenu({
  isSelf,
  onClose,
  onCopy,
  onReact,
  onDelete,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  isSelf: boolean;
  onClose: () => void;
  onCopy: () => void;
  onReact: () => void;
  onDelete: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Incoming: Copy, React, Delete
  // Outgoing: Copy, React, Delete for me, Delete for everyone
  const normalItems = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      ),
      label: 'Copy',
      action: onCopy,
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      ),
      label: 'React',
      action: onReact,
    },
  ];

  const deleteItems = isSelf
    ? [
        {
          label: 'Delete for me',
          action: onDeleteForMe,
        },
        {
          label: 'Delete for everyone',
          action: onDeleteForEveryone,
        },
      ]
    : [
        {
          label: 'Delete',
          action: onDelete,
        },
      ];

  return (
    <div
      ref={ref}
      className="overflow-hidden"
      style={{
        background: ACTION_MENU_BG,
        border: `0.7px solid ${ACTION_MENU_BORDER}`,
        borderRadius: '2px',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
        width: 'max-content',
        minWidth: '180px',
      }}>
      {/* Normal actions */}
      {normalItems.map((item, i) => (
        <button key={i}
          onClick={() => { item.action(); onClose(); }}
          className="w-full flex items-center transition-colors hover:bg-white/5"
          style={{ color: TEXT_PRIMARY }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: '44px', height: '40px' }}>
            {item.icon}
          </div>
          <div style={{ width: '0.7px', height: '18px', background: DIVIDER, flexShrink: 0 }} />
          <span className="text-sm" style={{ paddingLeft: '12px', paddingRight: '15px', whiteSpace: 'nowrap' }}>{item.label}</span>
        </button>
      ))}

      {/* Separator */}
      <div style={{ height: '0.7px', background: DIVIDER }} />

      {/* Delete actions */}
      {deleteItems.map((item, i) => (
        <button key={i}
          onClick={() => { item.action(); onClose(); }}
          className="w-full flex items-center transition-colors hover:bg-red-500/5"
          style={{ color: DELETE_RED }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: '44px', height: '40px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DELETE_RED} strokeWidth="1.6">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div style={{ width: '0.7px', height: '18px', background: 'rgba(224,85,85,0.3)', flexShrink: 0 }} />
          <span className="text-sm" style={{ paddingLeft: '12px', paddingRight: '15px', whiteSpace: 'nowrap' }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatDetail({ chat, onBack, currentUserId }: ChatDetailProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [aiStreamingMsgId, setAiStreamingMsgId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCall, setShowCall] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiConversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  // Stable supabase client — prevents real-time channel re-subscription on every render
  const supabase = useMemo(() => createClient(), []);
  const otherUserId = chat.otherUserId;

  // AI hook — streaming
  const { response: aiResponse, isLoading: aiLoading, error: aiError, sendMessage: sendAiMessage } = useChat('OPEN_AI', 'gpt-5.4', true);

  // Live-update streaming AI bubble
  const prevAiLoading = useRef(false);
  useEffect(() => {
    if (aiLoading && aiResponse && aiStreamingMsgId) {
      setMessages(prev => prev.map(m =>
        m.id === aiStreamingMsgId ? { ...m, text: aiResponse } : m
      ));
    }
    if (prevAiLoading.current && !aiLoading && aiResponse && aiStreamingMsgId) {
      // Streaming done — finalise the bubble
      setMessages(prev => prev.map(m =>
        m.id === aiStreamingMsgId ? { ...m, text: aiResponse, status: 'delivered' as const } : m
      ));
      // Store in conversation history for multi-turn context
      aiConversationRef.current = [
        ...aiConversationRef.current,
        { role: 'assistant', content: aiResponse },
      ];
      setAiStreamingMsgId(null);
    }
    prevAiLoading.current = aiLoading;
  }, [aiLoading, aiResponse, aiStreamingMsgId]);

  // ── Expiration sweep: remove expired messages every 10 seconds ──
  useEffect(() => {
    const sweep = () => {
      setMessages(prev => {
        const filtered = filterExpiredMessages(prev);
        // Only trigger re-render if something was actually removed
        return filtered.length < prev.length ? filtered : prev;
      });
    };
    const interval = setInterval(sweep, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      if (!currentUserId || !otherUserId) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('direct_messages')
          .select('id, sender_id, content, media_url, message_type, created_at, is_read, reactions')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
          .order('created_at', { ascending: true })
          .limit(100);

        if (!isMounted) return;

        if (data) {
          const now = Date.now();
          // Filter expired messages before setting state
          const mapped: Message[] = data
            .map((m: any) => ({
              id: m.id,
              text: m.content || '',
              time: formatTime(m.created_at),
              isSelf: m.sender_id === currentUserId,
              status: m.is_read ? 'read' : 'delivered',
              mediaUrl: m.media_url || undefined,
              mediaType: m.message_type !== 'text' ? m.message_type : undefined,
              reactions: m.reactions || {},
              deleteTimer: EXPIRATION_WINDOW_SECONDS,
              createdAt: m.created_at,
            }))
            .filter((m: Message) => {
              if (!m.createdAt) return true;
              const elapsed = (now - new Date(m.createdAt).getTime()) / 1000;
              return elapsed < EXPIRATION_WINDOW_SECONDS;
            });

          setMessages(mapped);
          await supabase.from('direct_messages').update({ is_read: true })
            .eq('sender_id', otherUserId).eq('receiver_id', currentUserId).eq('is_read', false);
        }
      } catch { /* silent */ } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMessages();

    if (!currentUserId || !otherUserId) return;

    // Build a stable channel name regardless of who is participant_one/two
    const [p1, p2] = [currentUserId, otherUserId].sort();
    const channelName = `dm_${p1}_${p2}`;

    const channel = supabase.channel(channelName)
      // Incoming messages (receiver = current user)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== otherUserId) return;
        // Check expiration before adding
        const elapsed = (Date.now() - new Date(msg.created_at).getTime()) / 1000;
        if (elapsed >= EXPIRATION_WINDOW_SECONDS) return;
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id, text: msg.content || '', time: formatTime(msg.created_at),
            isSelf: false, status: 'delivered', mediaUrl: msg.media_url || undefined,
            mediaType: msg.message_type !== 'text' ? msg.message_type : undefined, reactions: msg.reactions || {},
            deleteTimer: EXPIRATION_WINDOW_SECONDS,
            createdAt: msg.created_at,
          }];
        });
        supabase.from('direct_messages').update({ is_read: true }).eq('id', msg.id);
      })
      // Outgoing messages from another device (sender = current user)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `sender_id=eq.${currentUserId}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.receiver_id !== otherUserId) return;
        setMessages(prev => {
          // Replace optimistic entry if present, otherwise add
          const hasOptimistic = prev.some(m => m.id.startsWith('opt-') && m.text === (msg.content || '') && m.isSelf);
          if (hasOptimistic) {
            return prev.map(m =>
              m.id.startsWith('opt-') && m.text === (msg.content || '') && m.isSelf
                ? { ...m, id: msg.id, status: 'delivered' as const }
                : m
            );
          }
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id, text: msg.content || '', time: formatTime(msg.created_at),
            isSelf: true, status: 'delivered' as const, mediaUrl: msg.media_url || undefined,
            mediaType: msg.message_type !== 'text' ? msg.message_type : undefined, reactions: msg.reactions || {},
            deleteTimer: EXPIRATION_WINDOW_SECONDS,
            createdAt: msg.created_at,
          }];
        });
      })
      // Reaction / edit updates
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new as any;
        setMessages(prev => prev.map(m => {
          if (m.id !== msg.id) return m;
          // Update reactions
          const updatedReactions = msg.reactions || {};
          // Update delivery status: if the other user read our message, flip to 'read'
          const updatedStatus: Message['status'] = m.isSelf
            ? (msg.is_read ? 'read' : m.status)
            : m.status;
          return { ...m, reactions: updatedReactions, status: updatedStatus };
        }));
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId, supabase]);

  // Scroll to bottom — instant (no smooth) to avoid visual jank/flash
  // Only scrolls if user is already near the bottom (within 120px)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    // Auto-scroll only when near bottom or on initial load
    if (distanceFromBottom < 120 || loading) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // ── Test user auto-reply ──────────────────────────────────────────────────
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
  const DEMO_BOT_TYPING_REPLIES = [
    'Hey! Got your message 👋',
    'Thanks for reaching out!',
    'I received your message ✓',
    'Hello there! How can I help?',
    'Message received! 📨',
    'Hi! I am the PiChat demo bot.',
    'Testing 1-2-3... all good! ✅',
    'Roger that! 👍',
    'Loud and clear!',
    'Yep, I can see your message!',
    'The messaging system is working perfectly 🎉',
    'Great, the chat is live!',
    'I reply to every message you send me 😊',
    'PiChat messaging is working great!',
    'This is a demo reply from the bot 🤖',
  ];

  const triggerTestUserReply = useCallback(async () => {
    if (!currentUserId) return;
    // Show typing indicator
    setIsTyping(true);
    const delay = 800 + Math.random() * 1200; // 0.8s – 2s
    await new Promise(res => setTimeout(res, delay));
    setIsTyping(false);

    // Call API route to insert real DB message from demo bot
    try {
      await fetch('/api/demo-bot/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: currentUserId }),
      });
      // The real-time subscription in this component will pick up the new message
    } catch {
      // Fallback: show local message if API fails
      const text = DEMO_BOT_TYPING_REPLIES[Math.floor(Math.random() * DEMO_BOT_TYPING_REPLIES.length)];
      const replyMsg: Message = {
        id: `demo-reply-${Date.now()}`,
        text,
        time: formatTime(new Date().toISOString()),
        isSelf: false,
        status: 'delivered',
        reactions: {},
        deleteTimer: EXPIRATION_WINDOW_SECONDS,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, replyMsg]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  async function handleReaction(msgId: string, emoji: string) {
    if (!currentUserId) return;
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}) };
      const users: string[] = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUserId);
      if (idx >= 0) { users.splice(idx, 1); if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users; }
      else { reactions[emoji] = [...users, currentUserId]; }
      return { ...m, reactions };
    }));
    try {
      const { data: current } = await supabase.from('direct_messages').select('reactions').eq('id', msgId).single();
      const reactions: Record<string, string[]> = { ...(current?.reactions || {}) };
      const users: string[] = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = users.indexOf(currentUserId);
      if (idx >= 0) { users.splice(idx, 1); if (users.length === 0) delete reactions[emoji]; else reactions[emoji] = users; }
      else { reactions[emoji] = [...users, currentUserId]; }
      await supabase.from('direct_messages').update({ reactions }).eq('id', msgId);
    } catch { /* silent */ }
  }

  async function handleSend() {
    const text = inputText.trim();
    if (!text && !selectedMedia) return;
    if (!currentUserId || !otherUserId) return;
    const mediaToSend = selectedMedia;
    setSelectedMedia(null);
    setInputText('');

    if (isAiActive && text) {
      // ── AI mode: save user prompt as real DM, then stream AI reply ──
      const optimisticId = `opt-${Date.now()}`;
      const userMsg: Message = {
        id: optimisticId, text, time: formatTime(new Date().toISOString()),
        isSelf: true, status: 'sent', reactions: {},
        deleteTimer: EXPIRATION_WINDOW_SECONDS,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);

      // Persist user prompt to Supabase
      try {
        const { data } = await supabase.from('direct_messages').insert({
          sender_id: currentUserId, receiver_id: otherUserId, content: text,
          media_url: null, message_type: 'text',
        }).select('id').single();
        if (data) {
          setMessages(prev => prev.map(m =>
            m.id === optimisticId ? { ...m, id: data.id, status: 'delivered' as const } : m
          ));
        }
      } catch { /* silent */ }

      // Add user turn to conversation history
      aiConversationRef.current = [
        ...aiConversationRef.current,
        { role: 'user', content: text },
      ];

      // Insert a placeholder AI bubble
      const aiMsgId = `ai-${Date.now()}`;
      const aiPlaceholder: Message = {
        id: aiMsgId, text: '', time: formatTime(new Date().toISOString()),
        isSelf: false, status: 'sent', reactions: {},
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiPlaceholder]);
      setAiStreamingMsgId(aiMsgId);

      // Build messages array for OpenAI
      const apiMessages = [
        {
          role: 'system' as const,
          content: `You are a helpful AI assistant integrated into PiChat, a messaging app. The user is chatting with ${chat.name}. Be concise, friendly, and conversational. Keep responses short.`,
        },
        ...aiConversationRef.current,
      ];

      sendAiMessage(apiMessages, { max_completion_tokens: 512 });
      return;
    }

    // ── Normal send ──
    const optimisticId = `opt-${Date.now()}`;
    const newMsg: Message = {
      id: optimisticId, text, time: formatTime(new Date().toISOString()),
      isSelf: true, status: 'sent', mediaUrl: mediaToSend?.url, mediaType: mediaToSend?.type, reactions: {},
      deleteTimer: EXPIRATION_WINDOW_SECONDS,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);
    try {
      const { data } = await supabase.from('direct_messages').insert({
        sender_id: currentUserId, receiver_id: otherUserId, content: text,
        media_url: mediaToSend?.url || null, message_type: mediaToSend ? mediaToSend.type : 'text',
      }).select('id').single();
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: data.id, status: 'delivered' as const } : m));

        const [participantOne, participantTwo] = [currentUserId, otherUserId].sort();
        const convPayload = {
          participant_one: participantOne,
          participant_two: participantTwo,
          last_message_text: text,
          last_message_at: new Date().toISOString(),
          last_message_sender_id: currentUserId,
        };
        const { error: upsertErr } = await supabase.from('conversations').upsert(convPayload, {
          onConflict: 'participant_one,participant_two',
          ignoreDuplicates: false,
        });
        if (upsertErr) {
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('participant_one', participantOne)
            .eq('participant_two', participantTwo)
            .maybeSingle();
          if (existing?.id) {
            await supabase.from('conversations').update({
              last_message_text: text,
              last_message_at: new Date().toISOString(),
              last_message_sender_id: currentUserId,
            }).eq('id', existing.id);
          } else {
            await supabase.from('conversations').insert(convPayload);
          }
        }
      }
    } catch { /* silent */ }

    // ── Test user auto-reply ──
    if (otherUserId === TEST_USER_ID) {
      triggerTestUserReply();
    }
  }

  function handleCameraClick() { cameraInputRef.current?.click(); }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia({ url: URL.createObjectURL(file), type: 'image', file });
    e.target.value = '';
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia({ url: URL.createObjectURL(file), type: 'image', file });
    e.target.value = '';
    setShowAttachMenu(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia({ url: URL.createObjectURL(file), type: 'file', file });
    e.target.value = '';
    setShowAttachMenu(false);
  }

  async function handleMicToggle() {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false); setRecordingSeconds(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setSelectedMedia({ url, type: 'audio', file: new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' }) });
          stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true); setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds(s => {
            if (s >= 59) {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
              if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
              setIsRecording(false); return 0;
            }
            return s + 1;
          });
        }, 1000);
      } catch { alert('Microphone access is required to record voice messages.'); }
    }
  }

  function handleClearChat() { setMessages([]); }
  const fmtRecording = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Stable callbacks for MessageBubble — prevents inline arrow functions from defeating React.memo
  const handleLongPress = useCallback((msgId: string) => {
    setActiveActionMsgId(msgId);
  }, []);

  const handleReactionCb = useCallback((msgId: string, emoji: string) => {
    handleReaction(msgId, emoji);
    setActiveActionMsgId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, currentUserId]);

  const handleCloseActionMenu = useCallback(() => {
    setActiveActionMsgId(null);
  }, []);

  const handleDeleteForMeCb = useCallback((msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActiveActionMsgId(null);
  }, []);

  const handleDeleteForEveryoneCb = useCallback((msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActiveActionMsgId(null);
  }, []);

  // Callback for when a message expires in its own timer
  const handleMessageExpired = useCallback((msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  }, []);

  // Estimate header height for padding (sticky header)
  const HEADER_HEIGHT = 56;

  return (
    <div
      className="flex flex-col"
      style={{
        background: BG,
        fontFamily: 'Inter, sans-serif',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {showCall && <CallOverlay chat={chat} onEnd={() => setShowCall(false)} />}
      {showBlockReport && currentUserId && otherUserId && (
        <BlockReportModal chatName={chat.name} targetUserId={otherUserId} currentUserId={currentUserId} onClose={() => setShowBlockReport(false)} />
      )}

      {/* ── Header — fixed at top, never scrolls ── */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 relative shrink-0"
        style={{
          background: HEADER_BG,
          borderBottom: `0.7px solid ${DIVIDER}`,
          zIndex: 40,
          minHeight: `${HEADER_HEIGHT}px`,
          flexShrink: 0,
        }}>
        <button onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
          style={{ color: TEXT_PRIMARY }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <button className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm"
              style={{ background: chat.avatarColor }}>
              {chat.avatar ? (
                <AppImage src={chat.avatar} alt={`${chat.name} avatar`} width={36} height={36} className="w-full h-full object-cover" />
              ) : <span>{chat.name.charAt(0)}</span>}
            </div>
            {chat.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#4ade80', borderColor: HEADER_BG }} />
            )}
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: '16px', fontWeight: 500, color: TEXT_PRIMARY, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.name}</p>
            <p className="text-[10px] leading-tight" style={{ color: chat.isOnline ? '#4ade80' : TEXT_MUTED }}>
              {isAiActive ? (
                <span style={{ color: PICHAT_BLUE }}>AI mode active · powered by OpenAI</span>
              ) : (
                chat.isOnline ? 'online' : 'last seen recently'
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowCall(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
            style={{ color: TEXT_MUTED }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012 .01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
            </svg>
          </button>
          <button onClick={() => setShowMoreMenu(m => !m)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
            style={{ color: TEXT_MUTED }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="5" r="1.3" fill="currentColor" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" />
              <circle cx="12" cy="19" r="1.3" fill="currentColor" />
            </svg>
          </button>
        </div>

        {showMoreMenu && (
          <MoreMenu onClose={() => setShowMoreMenu(false)} onClearChat={handleClearChat}
            onBlockReport={() => setShowBlockReport(true)} chatName={chat.name} />
        )}
      </div>

      {/* ── Messages — flex-1 scrollable, independent of header/footer ── */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: '1 1 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          background: BG,
          ...DOT_BG_STYLE,
          paddingLeft: '10px',
          paddingRight: '10px',
          paddingTop: '12px',
          paddingBottom: '12px',
        }}
      >
        {/* Date separator */}
        <div className="flex items-center justify-center my-3">
          <span
            className="px-4 py-1"
            style={{
              background: DATE_SEP_BG,
              border: `0.7px solid ${DATE_SEP_BORDER}`,
              borderRadius: '2px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: TEXT_MUTED,
              fontSize: '10.5px',
              fontWeight: 400,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              lineHeight: 1.4,
            }}>
            Today
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={OUTGOING_BG} strokeWidth="1.8">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(37,99,168,0.15)', border: `1px solid ${OUTGOING_BORDER}` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={OUTGOING_BG} strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>No messages yet</p>
            <p className="text-xs mt-1" style={{ color: TEXT_MUTED }}>Say hi to {chat.name}!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                senderName={msg.id.startsWith('ai-') ? 'PiChat AI' : chat.name}
                avatarColor={msg.id.startsWith('ai-') ? PICHAT_BLUE : chat.avatarColor}
                isAiBubble={msg.id.startsWith('ai-') || msg.id === aiStreamingMsgId}
                currentUserId={currentUserId}
                showActionMenu={activeActionMsgId === msg.id}
                onLongPress={handleLongPress}
                onReaction={handleReactionCb}
                onCloseActionMenu={handleCloseActionMenu}
                onDeleteForMe={handleDeleteForMeCb}
                onDeleteForEveryone={handleDeleteForEveryoneCb}
                onExpired={handleMessageExpired}
              />
            ))}
          </div>
        )}

        {isTyping && (
          <div className="flex items-end gap-2 mt-2" style={{ marginLeft: '10px' }}>
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: chat.avatarColor }}>
              {chat.name.charAt(0)}
            </div>
            <div className="px-3 py-2.5 flex items-center gap-1"
              style={{ background: INCOMING_BG, border: `0.7px solid ${INCOMING_BORDER}`, borderRadius: '2px 2px 2px 2px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: TEXT_MUTED, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {aiLoading && aiStreamingMsgId && messages.find(m => m.id === aiStreamingMsgId)?.text === '' && (
          <div className="flex items-end gap-2 mt-2" style={{ marginLeft: '10px' }}>
            <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
              style={{ background: PICHAT_BLUE }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64">
                <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                  fill="none" stroke="#FFFFFF" strokeWidth="6"
                  strokeLinecap="square" strokeLinejoin="miter"/>
              </svg>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-1"
              style={{ background: INCOMING_BG, border: `0.7px solid ${INCOMING_BORDER}`, borderRadius: '2px 2px 2px 2px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: PICHAT_BLUE, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer — fixed at bottom, never scrolls ── */}
      <div
        className="flex flex-col px-3 pt-3 pb-3"
        style={{
          background: COMPOSER_BG,
          borderTop: isAiActive ? `0.7px solid ${PICHAT_BLUE}40` : `0.7px solid ${COMPOSER_BORDER}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'border-color 300ms ease',
          flexShrink: 0,
        }}>
        {selectedMedia && <div className="mb-2"><MediaPreview media={selectedMedia} onRemove={() => setSelectedMedia(null)} /></div>}

        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm mb-2"
            style={{ background: 'rgba(255,255,255,0.05)', color: TEXT_PRIMARY }}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-xs">Recording {fmtRecording(recordingSeconds)}</span>
            <span className="text-xs ml-auto" style={{ color: TEXT_MUTED }}>Tap mic to stop</span>
          </div>
        )}

        {/* AI mode banner */}
        {isAiActive && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2"
            style={{ background: `${PICHAT_BLUE}12`, border: `0.7px solid ${PICHAT_BLUE}30` }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64">
              <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                fill="none" stroke={PICHAT_BLUE} strokeWidth="6"
                strokeLinecap="square" strokeLinejoin="miter"/>
            </svg>
            <span className="text-xs font-medium flex-1" style={{ color: PICHAT_BLUE }}>
              AI mode · prompts go to OpenAI, replies appear here
            </span>
            <button onClick={() => { setIsAiActive(false); aiConversationRef.current = []; }}
              className="text-xs px-2 py-0.5 rounded-md transition-colors"
              style={{ color: TEXT_MUTED, background: 'rgba(255,255,255,0.05)' }}>
              Turn off
            </button>
          </div>
        )}

        {/* Input field */}
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={isAiActive ? 'Ask AI anything…' : 'Type a message…'}
          rows={1}
          className="w-full bg-transparent resize-none outline-none leading-relaxed py-1 mb-2.5"
          style={{ color: TEXT_PRIMARY, caretColor: isAiActive ? PICHAT_BLUE : OUTGOING_BG, fontSize: '15px', fontWeight: 400, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
        />

        {/* Divider line */}
        <div style={{ height: '0.7px', background: isAiActive ? `${PICHAT_BLUE}30` : DIVIDER, marginBottom: '10px', transition: 'background 300ms ease' }} />

        {/* Footer icons row */}
        <div className="flex items-center justify-between px-1" style={{ position: 'relative' }}>

          {/* Attachment menu popup — appears above the + button */}
          {showAttachMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                onClick={() => setShowAttachMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '44px',
                  left: '0',
                  background: ACTION_MENU_BG,
                  border: `0.7px solid ${ACTION_MENU_BORDER}`,
                  borderRadius: '2px',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                  zIndex: 50,
                  minWidth: '160px',
                }}
              >
                <button
                  onClick={() => { photoInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: TEXT_PRIMARY }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                  Photo
                </button>
                <div style={{ height: '0.7px', background: DIVIDER }} />
                <button
                  onClick={() => { fileInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: TEXT_PRIMARY }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  File
                </button>
              </div>
            </>
          )}

          {/* Hidden inputs for photo and file */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

          {/* 1. Plus — black container, white icon */}
          <FooterIconButton onClick={() => setShowAttachMenu(p => !p)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </FooterIconButton>

          {/* 2. AI Assistant — black container, uploaded SVG icon */}
          <button
            onClick={() => { const next = !isAiActive; setIsAiActive(next); if (!next) aiConversationRef.current = []; }}
            aria-label="AI Assistant"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              borderRadius: '2px',
              background: '#000000',
              border: 'none',
              padding: 0,
              flexShrink: 0,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg
              viewBox="150 280 724 1000"
              width="31"
              height="31"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', flexShrink: 0 }}
            >
              <path transform="translate(506,329)" d="m0 0h11l16 3 17 8 24 14 24 13 21 12 26 15 28 16 25 14 24 14 27 15 24 14 25 14 35 20 10 8 7 7 8 13 5 13 2 13v351l-4 16-8 15-9 10-7 6-26 15-21 12-26 15-25 14-26 15-25 14-19 11-21 12-23 13-24 14-41 23-22 12-13 4-5 1h-19l-15-4-16-8-24-14-23-13-52-30-56-32-24-14-25-14-17-10-28-16-24-14-11-7-10-9-7-10-6-12-3-12-1-7v-348l3-15 5-12 7-11 11-11 13-8 23-13 28-16 24-14 25-14 17-10 25-14 26-15 25-14 24-14 27-15 23-13 16-9 13-5zm1 33-13 4-25 14-18 10-105 60-27 15-17 10-23 13-24 14-25 14-19 11-9 7-6 8-4 10-1 6v342l3 11 5 9 6 7 15 9 56 32 19 11 28 16 23 13 21 12 24 14 25 14 17 10 49 28 14 7 8 2h14l12-4 26-14 21-12 25-14 22-13 23-13 21-12 23-13 26-15 25-14 24-14 27-15 22-13 10-9 6-10 2-9v-345l-4-13-6-8-8-7-28-16-23-13-21-12-23-13-28-16-23-13-56-32-25-14-21-12-25-14-16-9-8-2z" fill="#FEFEFE"/>
              <path transform="translate(515,518)" d="m0 0h35l27 3 19 4 27 9 25 12 15 10 11 9 10 9 11 12 11 16 10 19 6 16 5 21 2 13 1 12v28l-3 25-6 24-8 18-7 13-11 14-13 13-13 9-17 8-17 5-9 1h-11l-14-2-13-5-11-8-8-11-4-9-1-5-8 11-7 7-10 7-14 7-18 5-7 1h-20l-15-3-15-6-10-6-10-9-8-8-8-13-6-14-4-20v-35l3-18 7-21 9-17 8-11 11-13 13-11 13-8 17-8 19-5 8-1h21l14 3 12 5 11 8 9 10 1 4h2l1-10 4-17h48l-1 10-9 50-16 90-1 12 1 14 3 7 4 3 7 2h7l12-3 12-7 9-9 9-14 7-16 6-20 3-16 1-9v-32l-3-21-5-17-7-16-8-14-9-11-13-13-15-10-17-9-19-7-18-4-12-2-13-1h-27l-21 2-22 5-21 7-19 9-16 10-14 11-13 12-12 14-10 15-9 17-9 25-5 23-2 18v31l3 22 5 21 5 15 12 23 12 16 12 13 14 11 15 9 16 8 24 8 23 4 12 1h27l21-2 19-4 20-6 20-9 12-7h3l11 24 2 7-15 9-25 10-24 7-22 4-22 2h-25l-22-2-26-5-20-6-21-8-20-10-11-7-14-10-14-12-12-12-10-13-11-18-10-21-6-19-5-24-2-23v-19l2-25 5-25 9-27 8-16 9-16 12-16 12-14 8-8 8-7 13-10 15-10 18-10 20-9 27-9 23-5z" fill="#FEFEFE"/>
              <path transform="translate(506,329)" d="m0 0h11l16 3 17 8 24 14 24 13 21 12 26 15 28 16 25 14 24 14 27 15 24 14 25 14 35 20 10 8 7 7 8 13 5 13 2 13v351l-4 16-8 15-9 10-7 6-26 15-21 12-26 15-25 14-26 15-25 14-19 11-21 12-23 13-24 14-41 23-22 12-13 4-5 1h-19l-15-4-16-8-24-14-23-13-52-30-56-32-24-14-25-14-17-10-28-16-24-14-11-7-10-9-7-10-6-12-3-12-1-7v-348l3-15 5-12 7-11 11-11 13-8 23-13 28-16 24-14 25-14 17-10 25-14 26-15 25-14 24-14 27-15 23-13 16-9 13-5zm0 14-12 3-16 8-27 15-24 14-27 15-24 14-18 10-49 28-24 14-25 14-21 12-26 15-15 9-10 9-7 9-5 11-2 9v352l3 13 7 13 8 9 15 10 20 11 17 10 26 15 23 13 24 14 20 11 22 13 28 16 23 13 26 15 24 14 21 12 11 5 11 3h16l14-4 19-10 24-14 18-10 24-14 27-15 17-10 25-14 26-15 21-12 23-13 28-16 25-14 18-11 10-9 7-11 4-10 1-5 1-19v-326l-2-15-4-11-6-10-11-11-13-8-27-15-24-14-27-15-26-15-25-14-49-28-46-26-28-16-23-13-11-5-12-3z" fill="#010101"/>
              <path transform="translate(523,645)" d="m0 0h10l14 3 12 7 8 9 5 10 3 11v30l-4 21-5 16-6 14-7 10-6 7-11 8-14 7-11 3h-17l-10-3-10-6-8-9-6-12-3-11-1-7v-25l4-20 6-16 8-14 8-10 8-8 14-9 14-5z" fill="#000000"/>
            </svg>
          </button>

          {/* 3. Camera — black container, white icon */}
          <FooterIconButton onClick={handleCameraClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </FooterIconButton>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />

          {/* 4. Microphone — black container, white icon (red when recording) */}
          <FooterIconButton onClick={handleMicToggle} isActive={isRecording} activeColor="#ef4444">
            {isRecording ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.2">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="16" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0" />
                <line x1="12" y1="19" x2="12" y2="22" /><line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            )}
          </FooterIconButton>

          {/* 5. Speech-to-text (waveform) — black container, white icon */}
          <FooterIconButton onClick={() => {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="12" x2="2" y2="12" strokeWidth="2.5" />
              <line x1="5" y1="8" x2="5" y2="16" />
              <line x1="8" y1="5" x2="8" y2="19" />
              <line x1="11" y1="9" x2="11" y2="15" />
              <line x1="14" y1="6" x2="14" y2="18" />
              <line x1="17" y1="9" x2="17" y2="15" />
              <line x1="20" y1="8" x2="20" y2="16" />
              <line x1="23" y1="12" x2="23" y2="12" strokeWidth="2.5" />
            </svg>
          </FooterIconButton>

          {/* Send button — 22% larger icon, 0.7px #D7DDE5 border, black bg */}
          <SendButton
            onClick={handleSend}
            disabled={(!inputText.trim() && !selectedMedia) || (isAiActive && aiLoading)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Send Button ───────────────────────────────────────────────────────────────
// Black square container, 2px border-radius, #000000 bg, 0.7px solid #FFFFFF border
// Compass SVG fills container edge-to-edge (no padding). Active/pressed: inverted colors.
function SendButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  const [pressed, setPressed] = React.useState(false);

  // Default: black container, white circle fill, black lines
  // Active:  white container, black circle fill, white lines
  const containerBg = pressed ? '#FFFFFF' : '#000000';
  const containerBorder = pressed ? '0.7px solid #000000' : '0.7px solid #FFFFFF';
  const circleFill = pressed ? '#000000' : '#FFFFFF';
  const circleStroke = pressed ? '#FFFFFF' : '#000000';
  const lineStroke = pressed ? '#FFFFFF' : '#000000';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Send message"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        minWidth: '36px',
        minHeight: '36px',
        borderRadius: '2px',
        background: containerBg,
        border: containerBorder,
        padding: 0,
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        overflow: 'hidden',
        transition: 'background 120ms ease, border 120ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Compass SVG — outer circle fills the container edge-to-edge, no padding */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="36"
        height="36"
        viewBox="0 0 64 64"
        style={{ display: 'block' }}
      >
        {/* Outer white circle — fills the square container */}
        <circle cx="32" cy="32" r="32" fill={circleFill} stroke={circleStroke} strokeWidth="2" />
        {/* Compass hinge */}
        <circle cx="32" cy="16" r="4" fill="none" stroke={lineStroke} strokeWidth="2.5" />
        {/* Handle */}
        <path d="M 28 10 Q 32 6 36 10" fill="none" stroke={lineStroke} strokeWidth="2.5" strokeLinecap="round" />
        {/* Left leg */}
        <path d="M 32 20 L 22 50" fill="none" stroke={lineStroke} strokeWidth="3" strokeLinecap="round" />
        {/* Right leg */}
        <path d="M 32 20 L 44 50" fill="none" stroke={lineStroke} strokeWidth="3" strokeLinecap="round" />
        {/* Left needle tip */}
        <path d="M 22 50 L 20 56" fill="none" stroke={lineStroke} strokeWidth="2" strokeLinecap="round" />
        {/* Right pencil tip */}
        <path d="M 44 50 L 48 55" fill="none" stroke={lineStroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble = React.memo(function MessageBubble({
  message,
  senderName,
  avatarColor,
  isAiBubble,
  currentUserId,
  showActionMenu,
  onLongPress,
  onReaction,
  onCloseActionMenu,
  onDeleteForMe,
  onDeleteForEveryone,
  onExpired,
}: {
  message: Message;
  senderName: string;
  avatarColor?: string;
  isAiBubble?: boolean;
  currentUserId?: string;
  showActionMenu: boolean;
  onLongPress: (msgId: string) => void;
  onReaction: (msgId: string, emoji: string) => void;
  onCloseActionMenu: () => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForEveryone: (msgId: string) => void;
  onExpired: (msgId: string) => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const reactionEntries = Object.entries(message.reactions || {}).filter(([, users]) => users.length > 0);

  // Outgoing bubble: gradient, 2px radius, top-right corner flush (tail drawn separately)
  const outgoingBubbleStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${OUTGOING_GRADIENT_START} 0%, ${OUTGOING_GRADIENT_END} 100%)`,
    borderRadius: '2px 0px 2px 2px',
    display: 'inline-block',
    maxWidth: '100%',
    position: 'relative',
  };

  // Incoming bubble: #242F3C, white text, 2px radius, top-left corner flush (tail drawn separately)
  const incomingBubbleStyle: React.CSSProperties = {
    background: isAiBubble
      ? `linear-gradient(135deg, ${PICHAT_BLUE}18, rgba(36,47,61,0.95))`
      : INCOMING_BG,
    border: isAiBubble ? `0.7px solid ${PICHAT_BLUE}40` : `0.7px solid ${INCOMING_BORDER}`,
    borderRadius: '0px 2px 2px 2px',
    display: 'inline-block',
    maxWidth: '100%',
    position: 'relative',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexDirection: message.isSelf ? 'row-reverse' : 'row', marginBottom: '0' }}>
      {/* Avatar — incoming only */}
      {!message.isSelf && (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', background: avatarColor || '#3a4a6b', marginTop: '0px' }}>
          {isAiBubble ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 64 64">
              <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45"
                fill="none" stroke="#FFFFFF" strokeWidth="6"
                strokeLinecap="square" strokeLinejoin="miter"/>
            </svg>
          ) : (
            senderName.charAt(0)
          )}
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: message.isSelf ? 'flex-end' : 'flex-start' }}>
        {/* AI label */}
        {isAiBubble && (
          <p style={{ fontSize: '10px', marginBottom: '2px', marginLeft: '4px', color: PICHAT_BLUE, lineHeight: 1.4 }}>PiChat AI</p>
        )}

        {/* Bubble wrapper — hook is an SVG absolutely positioned at the top corner, same color, no seam */}
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
          }}
        >
          {/* ── Outgoing hook: SVG at top-right corner, same gradient end color ── */}
          {message.isSelf && (
            <svg
              width="8"
              height="10"
              viewBox="0 0 8 10"
              style={{
                position: 'absolute',
                top: 0,
                right: -8,
                display: 'block',
                overflow: 'visible',
              }}
            >
              <path d="M0,0 L8,0 L0,10 Z" fill={OUTGOING_GRADIENT_END} />
            </svg>
          )}
          {/* ── Incoming hook: SVG at top-left corner, same bubble bg color ── */}
          {!message.isSelf && (
            <svg
              width="8"
              height="10"
              viewBox="0 0 8 10"
              style={{
                position: 'absolute',
                top: 0,
                left: -8,
                display: 'block',
                overflow: 'visible',
              }}
            >
              <path d="M8,0 L0,0 L8,10 Z" fill={isAiBubble ? 'rgba(36,47,61,0.95)' : INCOMING_BG} />
            </svg>
          )}

          {/* Bubble */}
          <div
            style={{
              ...(message.isSelf ? outgoingBubbleStyle : incomingBubbleStyle),
              paddingLeft: '12px',
              paddingRight: '12px',
              paddingTop: '10px',
              paddingBottom: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              position: 'relative',
              zIndex: 1,
            }}
            onDoubleClick={() => setShowEmojiPicker(p => !p)}
            onContextMenu={(e) => { e.preventDefault(); onLongPress(message.id); }}
            onTouchStart={(e) => {
              const timer = setTimeout(() => { onLongPress(message.id); }, 500);
              (e.currentTarget as any)._longPressTimer = timer;
            }}
            onTouchEnd={(e) => {
              clearTimeout((e.currentTarget as any)._longPressTimer);
            }}
            onTouchMove={(e) => {
              clearTimeout((e.currentTarget as any)._longPressTimer);
            }}
          >
            {/* Message content */}
            {message.mediaUrl ? (
              <MediaBubble mediaUrl={message.mediaUrl} mediaType={message.mediaType || 'image'} content={message.text} />
            ) : message.text === '' && !message.isSelf ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="animate-bounce"
                    style={{ width: '6px', height: '6px', borderRadius: '50%', background: PICHAT_BLUE, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            ) : (
              <p style={{
                fontSize: '15px',
                fontWeight: 400,
                lineHeight: 1.4,
                color: '#FFFFFF',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                fontFamily: 'Inter, sans-serif',
              }}>
                {message.text}
              </p>
            )}

            {/* ── Metadata bar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '6px',
              gap: '0',
              flexWrap: 'nowrap',
              justifyContent: 'flex-end',
            }}>
              {/* Timestamp */}
              <span style={{
                fontSize: '10.5px',
                fontWeight: 400,
                color: message.isSelf ? 'rgba(255,255,255,0.75)' : META_COLOR,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, sans-serif',
              }}>
                {message.time}
              </span>

              {/* Timer — both outgoing and incoming */}
              {message.deleteTimer && message.createdAt && (
                <DeletionCountdown
                  totalSeconds={message.deleteTimer}
                  createdAt={message.createdAt}
                  isSelf={message.isSelf}
                  messageId={message.id}
                  onExpired={onExpired}
                />
              )}

              {/* Read receipts — incoming: no ticks, no seen indicator */}

              {/* Read receipts — outgoing only */}
              {message.isSelf && (
                <>
                  <span style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.3)', margin: '0 6px', flexShrink: 0 }} />
                  <DeliveryIcon status={message.status || 'sent'} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reaction counts */}
        {reactionEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', justifyContent: message.isSelf ? 'flex-end' : 'flex-start' }}>
            {reactionEntries.map(([emoji, users]) => {
              const reactedByMe = currentUserId ? users.includes(currentUserId) : false;
              return (
                <button
                  key={emoji}
                  onClick={() => onReaction(message.id, emoji)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '2px',
                    padding: '2px 6px', borderRadius: '999px',
                    background: reactedByMe ? 'rgba(42,171,238,0.25)' : 'rgba(36,47,61,0.9)',
                    border: `0.7px solid ${reactedByMe ? 'rgba(42,171,238,0.6)' : 'rgba(42,58,74,0.7)'}`,
                    backdropFilter: 'blur(8px)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '13px', lineHeight: 1 }}>{emoji}</span>
                  <span style={{ fontSize: '11px', color: reactedByMe ? '#2AABEE' : '#7C8FA3', fontWeight: 600, lineHeight: 1 }}>
                    {users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div style={{ marginTop: '4px', display: 'flex', justifyContent: message.isSelf ? 'flex-end' : 'flex-start' }}>
            <EmojiReactionPicker
              isSelf={message.isSelf}
              onSelect={(emoji) => { onReaction(message.id, emoji); setShowEmojiPicker(false); }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* Action menu */}
        {showActionMenu && (
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: message.isSelf ? 'flex-end' : 'flex-start' }}>
            <MessageActionMenu
              isSelf={message.isSelf}
              onClose={onCloseActionMenu}
              onCopy={() => { navigator.clipboard?.writeText(message.text).catch(() => {}); }}
              onReact={() => { setShowEmojiPicker(true); onCloseActionMenu(); }}
              onDelete={() => onDeleteForMe(message.id)}
              onDeleteForMe={() => onDeleteForMe(message.id)}
              onDeleteForEveryone={() => onDeleteForEveryone(message.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.text === next.message.text &&
    prev.message.status === next.message.status &&
    prev.message.reactions === next.message.reactions &&
    prev.showActionMenu === next.showActionMenu &&
    prev.isAiBubble === next.isAiBubble &&
    prev.onExpired === next.onExpired
  );
});

// ── Footer Icon Button ────────────────────────────────────────────────────────
// Standard footer button: black container + white icon by default.
// On press (active): white container + black icon.
// If isActive=true with a custom activeColor, the icon uses that color instead.
function FooterIconButton({
  children,
  onClick,
  disabled,
  isActive,
  activeColor,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isActive?: boolean;
  activeColor?: string;
  'aria-label'?: string;
}) {
  const [pressed, setPressed] = React.useState(false);

  const showInverted = pressed && !isActive;
  const bg = isActive && activeColor
    ? '#000000'
    : showInverted
    ? '#FFFFFF' :'#000000';
  const iconColor = isActive && activeColor
    ? activeColor
    : showInverted
    ? '#000000' :'#FFFFFF';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        minWidth: '36px',
        minHeight: '36px',
        borderRadius: '8px',
        background: bg,
        border: 'none',
        padding: 0,
        flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: iconColor,
        transition: 'background 120ms ease, color 120ms ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

// ── Delivery Icon ─────────────────────────────────────────────────────────────
function DeliveryIcon({ status }: { status: 'sent' | 'delivered' | 'read' }) {
  // delivered = white (#FFFFFF) double ticks
  // read = dark navy blue (#08306B) double ticks
  const tickColor = status === 'read' ? '#08306B' : '#FFFFFF';
  return (
    <svg width="15" height="9" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5l3 3 7-7" stroke={tickColor} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 5l3 3 7-7" stroke={tickColor} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Deletion Countdown Circle ─────────────────────────────────────────────────
// 7-hour window. Timer circle fills progressively using ◯◔◑◕● fill stages.
// Border: 0.7px #D7DDE5. Fill: #D7DDE5. Background: transparent.
// At 0: calls onExpired to remove message from parent.
function DeletionCountdown({
  totalSeconds,
  createdAt,
  isSelf,
  messageId,
  onExpired,
}: {
  totalSeconds: number;
  createdAt?: string;
  isSelf?: boolean;
  messageId: string;
  onExpired: (id: string) => void;
}) {
  // Store the parsed creation timestamp in a ref so the interval closure never goes stale
  const createdAtMs = React.useRef<number>(createdAt ? new Date(createdAt).getTime() : Date.now());

  // Update ref if createdAt prop changes (e.g. optimistic → real message)
  React.useEffect(() => {
    createdAtMs.current = createdAt ? new Date(createdAt).getTime() : Date.now();
  }, [createdAt]);

  const calcElapsed = React.useCallback(() => {
    return Math.floor((Date.now() - createdAtMs.current) / 1000);
  }, []);

  const [elapsed, setElapsed] = React.useState<number>(() => calcElapsed());
  const expiredRef = React.useRef(false);

  React.useEffect(() => {
    // Tick every second — only this component re-renders, not its parent
    const interval = setInterval(() => {
      const newElapsed = calcElapsed();
      setElapsed(newElapsed);
      // Trigger expiration exactly once when time runs out
      if (newElapsed >= totalSeconds && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpired(messageId);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [calcElapsed, totalSeconds, messageId, onExpired]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  // fraction: 0 = just created (empty circle ◯), 1 = fully elapsed (full circle ●)
  const fraction = Math.min(1, Math.max(0, elapsed / totalSeconds));

  const fmtRemaining = (): string => {
    if (remaining <= 0) return '0s';
    if (remaining >= 3600) {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    if (remaining >= 60) return `${Math.floor(remaining / 60)}m`;
    return `${remaining}s`;
  };

  // SVG pie-fill: 18×18 viewBox, circle centered at (9,9) with r=7.5
  // Border: 0.7px #D7DDE5. Fill: #D7DDE5. Background: transparent.
  const cx = 9, cy = 9, r = 7.5;

  const getPiePath = (f: number): string => {
    if (f <= 0) return '';
    // Full circle when fraction >= 1
    if (f >= 1) {
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`;
    }
    // Clockwise arc from 12 o'clock
    const angle = f * 2 * Math.PI;
    const endX = cx + r * Math.sin(angle);
    const endY = cy - r * Math.cos(angle);
    const largeArc = f > 0.5 ? 1 : 0;
    return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
  };

  const dividerColor = isSelf ? 'rgba(255,255,255,0.3)' : 'rgba(215,221,229,0.3)';
  const TIMER_COLOR = '#D7DDE5';

  return (
    <>
      {/* Divider before circle */}
      <span style={{ width: '1px', height: '10px', background: dividerColor, margin: '0 6px', flexShrink: 0 }} />

      {/* Live SVG pie-fill timer circle — transparent bg, #D7DDE5 border + fill */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{ flexShrink: 0, display: 'block', overflow: 'visible' }}
      >
        {/* Transparent background — no fill */}
        {/* Pie fill — #D7DDE5, grows clockwise as time elapses */}
        {fraction > 0 && (
          <path d={getPiePath(fraction)} fill={TIMER_COLOR} fillOpacity={1} />
        )}
        {/* Outer border — always visible white */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={TIMER_COLOR} strokeWidth="0.7" />
      </svg>

      {/* Divider after circle */}
      <span style={{ width: '1px', height: '10px', background: dividerColor, margin: '0 6px', flexShrink: 0 }} />

      {/* Remaining time label */}
      <span style={{
        fontSize: '10.5px',
        fontWeight: 500,
        color: '#D7DDE5',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
      }}>
        {fmtRemaining()}
      </span>
    </>
  );
}