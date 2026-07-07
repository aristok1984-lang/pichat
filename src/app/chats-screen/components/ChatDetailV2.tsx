'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ConversationItem } from './ChatsScreen';
import AppImage from '@/components/ui/AppImage';
import { useChat } from '@/lib/hooks/useChat';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG = '#0E1621';
const HEADER_BG = '#17212B';
const INCOMING_BG = '#242F3C';
const INCOMING_BORDER = 'rgba(42,58,74,0.80)';
const OUTGOING_GRADIENT_START = '#2A97DF';
const OUTGOING_GRADIENT_END = '#52C5FC';
const OUTGOING_BG = '#1A8FCC';
const OUTGOING_BORDER = 'rgba(42,171,238,0.45)';
const COMPOSER_BG = '#17212B';
const COMPOSER_BORDER = 'rgba(42,58,74,0.80)';
const DATE_SEP_BG = 'rgba(23,33,43,0.85)';
const DATE_SEP_BORDER = 'rgba(42,58,74,0.60)';
const ACTION_MENU_BG = '#17212B';
const ACTION_MENU_BORDER = 'rgba(42,58,74,0.80)';
const DIVIDER = 'rgba(42,58,74,0.80)';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED = '#7C8FA3';
const DELETE_RED = '#EF4444';
const META_COLOR = '#D7DDE5';
const PICHAT_BLUE = '#2AABEE';
const ONLINE_GREEN = '#4CCF7D';
const READ_TICK_COLOR = '#0B3D91';

// Timer constants
const MAX_TIMER_MS = 7 * 60 * 60 * 1000; // 7 hours in ms

// ── Module-level message cache (survives component unmount/remount) ────────────
const messageCache = new Map<string, Message[]>();

const DEMO_BOT_ID = '00000000-0000-0000-0000-000000000001';

const DOT_BG: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle, #D7DDE5 0.25px, transparent 0.25px)',
  backgroundSize: '7px 7px',
  backgroundRepeat: 'repeat',
};

const PAGE_SIZE = 30;
const TYPING_TIMEOUT = 3000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReplyPreview {
  id: string;
  content: string;
  senderName: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId?: string;
  content: string;
  messageType: string;
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  isDeleted: boolean;
  deletedFor: string[];
  deletedForSender: boolean;
  deletedForReceiver: boolean;
  deletedForEveryone: boolean;
  replyToId?: string;
  replyPreview?: ReplyPreview;
  reactions: Record<string, string[]>;
  createdAt: string;
  isSelf: boolean;
  // Timer fields
  expiresAt?: string;
  deleteAfterMs?: number;
  readAt?: string;
}

interface ChatDetailV2Props {
  conversation: ConversationItem;
  currentUserId: string;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateSep(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date: msg.createdAt, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

function mapRow(row: any, currentUserId: string, allRows: any[]): Message {
  const replyRow = row.reply_to_id ? allRows.find((r: any) => r.id === row.reply_to_id) : null;
  const createdAt = row.created_at;
  const deleteAfterMs = row.delete_after_ms || MAX_TIMER_MS;
  const expiresAt = row.expires_at
    ? row.expires_at
    : (createdAt ? new Date(new Date(createdAt).getTime() + deleteAfterMs).toISOString() : undefined);

  // Determine read status: if read_at is set, message is read
  const isRead = !!row.read_at;
  const status: 'sent' | 'delivered' | 'read' = isRead ? 'read' : ((row.status as any) || 'sent');

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id || undefined,
    content: row.content || '',
    messageType: row.message_type || 'text',
    mediaUrl: row.media_url || undefined,
    status,
    isEdited: row.is_edited || false,
    isDeleted: row.is_deleted || row.deleted_for_everyone || false,
    deletedFor: Array.isArray(row.deleted_for) ? row.deleted_for : [],
    deletedForSender: row.deleted_for_sender || false,
    deletedForReceiver: row.deleted_for_receiver || false,
    deletedForEveryone: row.deleted_for_everyone || false,
    replyToId: row.reply_to_id || undefined,
    replyPreview: replyRow ? {
      id: replyRow.id,
      content: replyRow.content || '',
      senderName: replyRow.sender_id === currentUserId ? 'You' : 'Them',
    } : undefined,
    reactions: row.reactions || {},
    createdAt,
    isSelf: row.sender_id === currentUserId,
    expiresAt,
    deleteAfterMs,
    readAt: row.read_at || undefined,
  };
}

// ── Timer Circle SVG ──────────────────────────────────────────────────────────
function TimerCircle({ createdAt, totalMs }: { createdAt: string; totalMs: number }) {
  const r = 7;
  const circumference = 2 * Math.PI * r;
  const svgRef = React.useRef<SVGCircleElement>(null);

  React.useEffect(() => {
    let rafId: number;
    const createdTime = new Date(createdAt).getTime();

    function tick() {
      const elapsed = Date.now() - createdTime;
      const progress = totalMs > 0 ? Math.max(0, Math.min(1, elapsed / totalMs)) : 0;
      const dashOffset = circumference * (1 - progress);
      if (svgRef.current) {
        svgRef.current.style.strokeDashoffset = String(dashOffset);
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [createdAt, totalMs, circumference]);

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, display: 'block' }}>
      <circle cx="8" cy="8" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <circle
        ref={svgRef}
        cx="8" cy="8" r={r}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}

// ── Meta Row ──────────────────────────────────────────────────────────────────
function MetaRow({ msg, remainingMs, totalMs }: { msg: Message; remainingMs: number; totalMs: number }) {
  const isSelf = msg.isSelf;
  const tickOpacity = msg.status === 'read' ? 1 : 0.55;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: '0px', marginTop: '5px', fontSize: '10.5px', fontWeight: 300,
      lineHeight: 1, whiteSpace: 'nowrap', color: '#FFFFFF',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(msg.createdAt)}</span>
      <span style={{ display: 'inline-block', width: '1px', height: '11px', background: 'rgba(255,255,255,0.45)', margin: '0 6px', flexShrink: 0 }} />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCountdown(remainingMs)}</span>
      <span style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center' }}>
        <TimerCircle createdAt={msg.createdAt} totalMs={totalMs} />
      </span>
      <span style={{ display: 'inline-block', width: '1px', height: '18px', background: 'rgba(255,255,255,0.35)', marginLeft: '8px', marginRight: '8px', flexShrink: 0, alignSelf: 'center' }} />
      {isSelf && (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="15" height="9" viewBox="0 0 16 10" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 5l3 3 7-7" stroke={READ_TICK_COLOR} strokeWidth="1.6" strokeLinecap="round" strokeOpacity={tickOpacity} />
            <path d="M5 5l3 3 7-7" stroke={READ_TICK_COLOR} strokeWidth="1.6" strokeLinecap="round" strokeOpacity={tickOpacity} />
          </svg>
        </span>
      )}
    </div>
  );
}

// ── Footer Icon Button ────────────────────────────────────────────────────────
function FooterIconButton({
  children, onClick, disabled, isActive, activeColor, 'aria-label': ariaLabel,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  isActive?: boolean; activeColor?: string; 'aria-label'?: string;
}) {
  const [pressed, setPressed] = React.useState(false);
  const showInverted = pressed && !isActive;
  const bg = isActive && activeColor ? '#000000' : showInverted ? '#FFFFFF' : '#000000';
  const iconColor = isActive && activeColor ? activeColor : showInverted ? '#000000' : '#FFFFFF';

  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={ariaLabel}
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '36px', height: '36px', minWidth: '36px', minHeight: '36px',
        borderRadius: '8px', background: bg, border: 'none', padding: 0, flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, color: iconColor,
        transition: 'background 120ms ease, color 120ms ease', WebkitTapHighlightColor: 'transparent',
      }}
    >{children}</button>
  );
}

// ── Send Button (Compass) ─────────────────────────────────────────────────────
function SendButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  const [pressed, setPressed] = React.useState(false);
  const containerBg = pressed ? '#FFFFFF' : '#000000';
  const containerBorder = pressed ? '0.7px solid #000000' : '0.7px solid #FFFFFF';
  const circleFill = pressed ? '#000000' : '#FFFFFF';
  const circleStroke = pressed ? '#FFFFFF' : '#000000';
  const lineStroke = pressed ? '#FFFFFF' : '#000000';

  return (
    <button
      onClick={onClick} disabled={disabled} aria-label="Send message"
      onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '36px', height: '36px', minWidth: '36px', minHeight: '36px',
        borderRadius: '2px', background: containerBg, border: containerBorder, padding: 0, flexShrink: 0,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, overflow: 'hidden',
        transition: 'background 120ms ease, border 120ms ease', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 64 64" style={{ display: 'block' }}>
        <circle cx="32" cy="32" r="32" fill={circleFill} stroke={circleStroke} strokeWidth="2" />
        <circle cx="32" cy="16" r="4" fill="none" stroke={lineStroke} strokeWidth="2.5" />
        <path d="M 28 10 Q 32 6 36 10" fill="none" stroke={lineStroke} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 32 20 L 22 50" fill="none" stroke={lineStroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M 32 20 L 44 50" fill="none" stroke={lineStroke} strokeWidth="3" strokeLinecap="round" />
        <path d="M 22 50 L 20 56" fill="none" stroke={lineStroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M 44 50 L 48 55" fill="none" stroke={lineStroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ── Reaction Picker ───────────────────────────────────────────────────────────
const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function ReactionPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} className="flex items-center gap-1 px-2 py-1.5 rounded-full"
      style={{ background: ACTION_MENU_BG, border: `1px solid ${ACTION_MENU_BORDER}`, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      {QUICK_EMOJIS.map(e => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }}
          className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center">
          {e}
        </button>
      ))}
    </div>
  );
}

// ── Message Action Menu ───────────────────────────────────────────────────────
function MessageActionMenu({
  isSelf, onClose, onCopy, onReact, onReply, onEdit, onDeleteForMe, onDeleteForEveryone,
}: {
  isSelf: boolean; onClose: () => void; onCopy: () => void; onReact: () => void;
  onReply: () => void; onEdit?: () => void; onDeleteForMe: () => void; onDeleteForEveryone?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const actions = [
    { label: 'Reply', action: onReply },
    { label: 'Copy', action: onCopy },
    { label: 'React', action: onReact },
    ...(isSelf && onEdit ? [{ label: 'Edit', action: onEdit }] : []),
  ];

  return (
    <div ref={ref} className="overflow-hidden"
      style={{ background: ACTION_MENU_BG, border: `0.7px solid ${ACTION_MENU_BORDER}`, borderRadius: '2px', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', minWidth: '180px' }}>
      {actions.map((a, i) => (
        <button key={i} onClick={() => { a.action(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors"
          style={{ color: TEXT_PRIMARY, borderBottom: i < actions.length - 1 ? `0.5px solid ${DIVIDER}` : 'none' }}>
          {a.label}
        </button>
      ))}
      <div style={{ height: '0.7px', background: DIVIDER }} />
      {isSelf ? (
        <>
          <button onClick={() => { onDeleteForMe(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-red-500/5 transition-colors"
            style={{ color: DELETE_RED }}>
            Delete for me
          </button>
          {onDeleteForEveryone && (
            <button onClick={() => { onDeleteForEveryone(); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-red-500/5 transition-colors"
              style={{ color: DELETE_RED, borderTop: `0.5px solid ${DIVIDER}` }}>
              Delete for everyone
            </button>
          )}
        </>
      ) : (
        <button onClick={() => { onDeleteForMe(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-red-500/5 transition-colors"
          style={{ color: DELETE_RED }}>
          Delete
        </button>
      )}
    </div>
  );
}

// ── More Menu ─────────────────────────────────────────────────────────────────
function MoreMenu({ onClose, onClearChat, chatName }: {
  onClose: () => void; onClearChat: () => void; chatName: string;
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
      <button onClick={() => { onClearChat(); onClose(); }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
        style={{ color: TEXT_PRIMARY }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
        Clear Chat
      </button>
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, currentUserId, onLongPress, showReactionPicker, onReact, onCloseReactionPicker, now,
}: {
  msg: Message; currentUserId: string;
  onLongPress: (id: string, e: React.MouseEvent | React.TouchEvent) => void;
  showReactionPicker: boolean; onReact: (emoji: string) => void; onCloseReactionPicker: () => void;
  now: number;
}) {
  const isSelf = msg.isSelf;

  // Determine if message is hidden for current user
  const isHidden = msg.deletedForEveryone ||
    msg.isDeleted ||
    (isSelf && msg.deletedForSender) ||
    (!isSelf && msg.deletedForReceiver) ||
    msg.deletedFor.includes(currentUserId);

  const reactionEntries = Object.entries(msg.reactions || {}).filter(([, users]) => (users as string[]).length > 0);

  // Timer calculation from Supabase expires_at
  const totalMs = msg.deleteAfterMs || MAX_TIMER_MS;
  const expiresAt = msg.expiresAt ? new Date(msg.expiresAt).getTime() : (new Date(msg.createdAt).getTime() + totalMs);
  const remainingMs = Math.max(0, expiresAt - now);

  const outgoingBubbleStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${OUTGOING_GRADIENT_START} 0%, ${OUTGOING_GRADIENT_END} 100%)`,
    borderRadius: '2px 0px 2px 2px', display: 'inline-block', maxWidth: '100%', position: 'relative',
  };

  const incomingBubbleStyle: React.CSSProperties = {
    background: INCOMING_BG, border: `0.7px solid ${INCOMING_BORDER}`,
    borderRadius: '0px 2px 2px 2px', display: 'inline-block', maxWidth: '100%', position: 'relative',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexDirection: isSelf ? 'row-reverse' : 'row', marginBottom: '8px' }}>
      {!isSelf && (
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', background: '#3a4a6b', marginTop: '0px' }}>
          <span>?</span>
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {isSelf && (
            <svg width="8" height="10" viewBox="0 0 8 10" style={{ position: 'absolute', top: 0, right: -8, display: 'block', overflow: 'visible' }}>
              <path d="M0,0 L8,0 L0,10 Z" fill={OUTGOING_GRADIENT_END} />
            </svg>
          )}
          {!isSelf && (
            <svg width="8" height="10" viewBox="0 0 8 10" style={{ position: 'absolute', top: 0, left: -8, display: 'block', overflow: 'visible' }}>
              <path d="M8,0 L0,0 L8,10 Z" fill={INCOMING_BG} />
            </svg>
          )}

          <div
            style={{
              ...(isSelf ? outgoingBubbleStyle : incomingBubbleStyle),
              paddingLeft: '12px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
              cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 1,
              ...(isHidden ? { background: 'transparent', border: `1px dashed ${DIVIDER}`, borderRadius: '2px' } : {}),
            }}
            onContextMenu={e => { e.preventDefault(); onLongPress(msg.id, e); }}
            onTouchStart={e => {
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const t = setTimeout(() => {
                onLongPress(msg.id, { currentTarget: { getBoundingClientRect: () => rect } } as any);
              }, 500);
              (el as any)._lpt = t;
            }}
            onTouchEnd={e => clearTimeout((e.currentTarget as any)?._lpt)}
            onTouchMove={e => clearTimeout((e.currentTarget as any)?._lpt)}
          >
            {msg.replyPreview && !isHidden && (
              <div className="mb-2 px-2 py-1.5 rounded border-l-2 text-xs"
                style={{ background: 'rgba(255,255,255,0.05)', borderLeftColor: PICHAT_BLUE }}>
                <p className="font-semibold mb-0.5" style={{ color: PICHAT_BLUE }}>{msg.replyPreview.senderName}</p>
                <p className="truncate" style={{ color: TEXT_MUTED }}>{msg.replyPreview.content}</p>
              </div>
            )}

            {isHidden ? (
              <p className="text-xs italic" style={{ color: TEXT_MUTED }}>
                {msg.deletedForEveryone || msg.isDeleted ? '🚫 This message was deleted' : '🚫 You deleted this message'}
              </p>
            ) : msg.messageType === 'image' && msg.mediaUrl ? (
              <div>
                <div className="rounded overflow-hidden" style={{ maxWidth: '220px' }}>
                  <AppImage src={msg.mediaUrl} alt="Shared image" width={220} height={180} className="w-full object-cover" />
                </div>
                {msg.content && <p className="text-sm mt-1" style={{ color: TEXT_PRIMARY }}>{msg.content}</p>}
                <MetaRow msg={msg} remainingMs={remainingMs} totalMs={totalMs} />
              </div>
            ) : (
              <>
                <p style={{ fontSize: '15px', fontWeight: 400, lineHeight: 1.4, color: '#FFFFFF', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                  {msg.content}
                </p>
                {!isHidden && <MetaRow msg={msg} remainingMs={remainingMs} totalMs={totalMs} />}
              </>
            )}
          </div>
        </div>

        {reactionEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', justifyContent: isSelf ? 'flex-end' : 'flex-start' }}>
            {reactionEntries.map(([emoji, users]) => (
              <span key={emoji} className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${DIVIDER}` }}>
                {emoji} {(users as string[]).length}
              </span>
            ))}
          </div>
        )}

        {showReactionPicker && (
          <div className={`absolute z-30 bottom-full mb-2 ${isSelf ? 'right-0' : 'left-0'}`}>
            <ReactionPicker onSelect={onReact} onClose={onCloseReactionPicker} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Message Search ────────────────────────────────────────────────────────────
function MessageSearch({ messages, onClose, onJump }: {
  messages: Message[]; onClose: () => void; onJump: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    return messages.filter(m => m.content.toLowerCase().includes(q.toLowerCase()) && !m.isDeleted);
  }, [q, messages]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: BG }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: HEADER_BG, borderBottom: `1px solid ${DIVIDER}` }}>
        <button onClick={onClose} className="p-1.5" style={{ color: TEXT_MUTED }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search messages…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: TEXT_PRIMARY }} />
        {q && (
          <button onClick={() => setQ('')} style={{ color: TEXT_MUTED }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {q && results.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm" style={{ color: TEXT_MUTED }}>No messages found</p>
          </div>
        ) : (
          results.map(m => (
            <button key={m.id} onClick={() => { onJump(m.id); onClose(); }}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
              style={{ borderBottom: `1px solid rgba(42,58,74,0.3)` }}>
              <p className="text-xs mb-1" style={{ color: TEXT_MUTED }}>{formatTime(m.createdAt)}</p>
              <p className="text-sm" style={{ color: TEXT_PRIMARY }}>{m.content}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ message, onSave, onClose }: { message: Message; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(message.content);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-sm rounded-t-2xl overflow-hidden" style={{ background: HEADER_BG, border: `1px solid ${DIVIDER}` }}>
        <div className="px-4 pt-4 pb-2" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
          <h3 className="text-sm font-bold" style={{ color: TEXT_PRIMARY }}>Edit Message</h3>
        </div>
        <div className="px-4 py-3">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
            className="w-full bg-transparent text-sm outline-none resize-none"
            style={{ color: TEXT_PRIMARY }} />
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY }}>Cancel</button>
          <button onClick={() => { onSave(text.trim()); onClose(); }} disabled={!text.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: OUTGOING_BG, opacity: !text.trim() ? 0.5 : 1 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatDetailV2({ conversation, currentUserId, onBack }: ChatDetailV2Props) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const cached = messageCache.get(conversation.id);
    if (cached && cached.length > 0) {
      const now = Date.now();
      return cached.filter(m => {
        if (m.isDeleted || m.deletedForEveryone) return true;
        const totalMs = m.deleteAfterMs || MAX_TIMER_MS;
        const expiresAt = m.expiresAt
          ? new Date(m.expiresAt).getTime()
          : new Date(m.createdAt).getTime() + totalMs;
        return now < expiresAt;
      });
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = messageCache.get(conversation.id);
    return !cached || cached.length === 0;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [actionMsgId, setActionMsgId] = useState<string | null>(null);
  const [actionPos, setActionPos] = useState({ x: 0, y: 0 });
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherLastSeen, setOtherLastSeen] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [aiStreamingMsgId, setAiStreamingMsgId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiConversationRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const convId = conversation.id;
  const otherId = conversation.otherUserId;

  // ── Tick every second for timer circles ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Sync messages to module-level cache ──────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      messageCache.set(convId, messages);
    }
  }, [messages, convId]);

  const pendingDeletionRef = useRef<Set<string>>(new Set());

  // ── Expire messages when timer hits 0 ────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    const expired = messages.filter(m => {
      if (m.isDeleted || m.deletedForEveryone) return false;
      if (pendingDeletionRef.current.has(m.id)) return false;
      const totalMs = m.deleteAfterMs || MAX_TIMER_MS;
      const expiresAt = m.expiresAt ? new Date(m.expiresAt).getTime() : (new Date(m.createdAt).getTime() + totalMs);
      return now >= expiresAt;
    });
    if (expired.length === 0) return;

    expired.forEach(m => pendingDeletionRef.current.add(m.id));

    const timers = expired.map(m =>
      setTimeout(() => {
        pendingDeletionRef.current.delete(m.id);
        setMessages(prev => prev.filter(msg => msg.id !== m.id));
        // Delete from Supabase (only real DB messages)
        if (!m.id.startsWith('opt-') && !m.id.startsWith('ai-')) {
          supabase.from('messages').delete().eq('id', m.id).then(() => {});
        }
      }, 300)
    );

    return () => timers.forEach(t => clearTimeout(t));
  }, [now, messages, currentUserId, supabase]);

  // AI hook — streaming
  const { response: aiResponse, isLoading: aiLoading, sendMessage: sendAiMessage } = useChat('OPEN_AI', 'gpt-4o', true);

  // Live-update streaming AI bubble
  const prevAiLoading = useRef(false);
  useEffect(() => {
    if (aiLoading && aiResponse && aiStreamingMsgId) {
      setMessages(prev => prev.map(m =>
        m.id === aiStreamingMsgId ? { ...m, content: aiResponse } : m
      ));
    }
    if (prevAiLoading.current && !aiLoading && aiResponse && aiStreamingMsgId) {
      setMessages(prev => prev.map(m =>
        m.id === aiStreamingMsgId ? { ...m, content: aiResponse, status: 'delivered' as const } : m
      ));
      aiConversationRef.current = [...aiConversationRef.current, { role: 'assistant', content: aiResponse }];
      setAiStreamingMsgId(null);
    }
    prevAiLoading.current = aiLoading;
  }, [aiLoading, aiResponse, aiStreamingMsgId]);

  // ── Image upload ──────────────────────────────────────────────────────────
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${currentUserId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      setSelectedMedia({ url: data.publicUrl, type: 'image' });
    } catch {
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia({ url: URL.createObjectURL(file), type: 'image' });
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedMedia({ url: URL.createObjectURL(file), type: 'image' });
    if (photoInputRef.current) photoInputRef.current.value = '';
    setShowAttachMenu(false);
  }

  async function handleMicToggle() {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setSelectedMedia({ url, type: 'audio' });
          stream.getTracks().forEach(t => t.stop());
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds(s => {
            if (s >= 59) {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
              if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
              setIsRecording(false);
              return 0;
            }
            return s + 1;
          });
        }, 1000);
      } catch {
        // Microphone not available
      }
    }
  }

  const fmtRecording = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Load messages (paginated) — always from Supabase ─────────────────────
  const loadMessages = useCallback(async (fromOffset = 0, append = false) => {
    if (!convId) return;
    if (fromOffset === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const nowIso = new Date().toISOString();

      // Delete expired messages from DB on initial load
      if (fromOffset === 0) {
        try {
          await supabase.from('messages')
            .delete()
            .eq('conversation_id', convId)
            .lt('expires_at', nowIso)
            .not('expires_at', 'is', null);
        } catch { /* silent */ }
      }

      const { data, error: err } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .range(fromOffset, fromOffset + PAGE_SIZE - 1);

      if (err) throw err;

      // Reverse so oldest-first
      const rows = (data || []).reverse();
      setHasMore(rows.length === PAGE_SIZE);

      const mapped = rows.map((r: any) => mapRow(r, currentUserId, data || []));

      if (append) {
        setMessages(prev => [...mapped, ...prev]);
      } else {
        setMessages(prev => {
          const dbIds = new Set(mapped.map((m: Message) => m.id));
          // Keep local-only optimistic/AI messages not yet confirmed in DB
          const localOnly = prev.filter(m =>
            !dbIds.has(m.id) && (m.id.startsWith('opt-') || m.id.startsWith('ai-') || m.id.startsWith('demo-'))
          );
          const combined = [...mapped, ...localOnly].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          messageCache.set(convId, combined);
          return combined;
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }

      setOffset(fromOffset + rows.length);

      // Mark incoming unread messages as read (set read_at = now)
      const unreadIncoming = rows.filter((r: any) =>
        r.sender_id !== currentUserId && !r.read_at
      );
      if (unreadIncoming.length > 0) {
        const readNow = new Date().toISOString();
        const unreadIds = unreadIncoming.map((r: any) => r.id);
        await supabase.from('messages')
          .update({ read_at: readNow, status: 'read' })
          .in('id', unreadIds);
        // Update local state to reflect read status
        setMessages(prev => prev.map(m =>
          unreadIds.includes(m.id) ? { ...m, readAt: readNow, status: 'read' as const } : m
        ));
      }
    } catch {
      setError('Failed to load messages. Tap to retry.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [convId, currentUserId, supabase]);

  // ── Fetch presence ────────────────────────────────────────────────────────
  const fetchPresence = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('user_presence')
        .select('is_online, last_seen')
        .eq('user_id', otherId)
        .maybeSingle();
      if (data) {
        setOtherOnline(data.is_online);
        setOtherLastSeen(data.last_seen);
      }
    } catch { /* silent */ }
  }, [otherId, supabase]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadMessages(0);
    fetchPresence();
  }, [convId]);

  // ── Real-time subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!convId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`conv_detail_${convId}_${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, async (payload) => {
        const row = payload.new as any;
        const mapped = mapRow(row, currentUserId, [row]);

        if (row.sender_id === currentUserId) {
          // Message from another device/tab — replace optimistic or add if missing
          setMessages(prev => {
            if (prev.find(m => m.id === mapped.id)) return prev;
            const optIdx = [...prev].reverse().findIndex(
              m => m.id.startsWith('opt-') && m.content === mapped.content && m.isSelf
            );
            const realIdx = optIdx !== -1 ? prev.length - 1 - optIdx : -1;
            if (realIdx !== -1) {
              const next = [...prev];
              next[realIdx] = mapped;
              return next;
            }
            return [...prev, mapped];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          return;
        }

        // Incoming message from the other user
        setMessages(prev => {
          if (prev.find(m => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        // Mark as read immediately since we're viewing the chat
        const readNow = new Date().toISOString();
        await supabase.from('messages')
          .update({ read_at: readNow, status: 'read' })
          .eq('id', row.id);
        // Update local state
        setMessages(prev => prev.map(m =>
          m.id === row.id ? { ...m, readAt: readNow, status: 'read' as const } : m
        ));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const row = payload.new as any;
        setMessages(prev => prev.map(m =>
          m.id === row.id ? { ...m, ...mapRow(row, currentUserId, [row]) } : m
        ));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const old = payload.old as any;
        if (old?.id) {
          setMessages(prev => prev.filter(m => m.id !== old.id));
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_indicators',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as any;
          if (old?.user_id !== currentUserId) setOtherTyping(false);
          return;
        }
        const row = payload.new as any;
        if (row && row.user_id !== currentUserId) {
          setOtherTyping(true);
          setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT + 500);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: `user_id=eq.${otherId}`,
      }, (payload) => {
        const p = payload.new as any;
        if (p) { setOtherOnline(p.is_online); setOtherLastSeen(p.last_seen); }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [convId, currentUserId, otherId, supabase]);

  // ── Cleanup recording on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop < 80) {
      const prevHeight = container.scrollHeight;
      loadMessages(offset, true).then(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevHeight;
          }
        });
      });
    }
  }, [loadingMore, hasMore, offset, loadMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.addEventListener('scroll', handleScroll);
    return () => { if (container) container.removeEventListener('scroll', handleScroll); };
  }, [handleScroll]);

  // ── Typing indicator ──────────────────────────────────────────────────────
  const sendTypingIndicator = useCallback(async () => {
    try {
      await supabase.from('typing_indicators').upsert({
        conversation_id: convId,
        user_id: currentUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id' });
    } catch { /* silent */ }
  }, [convId, currentUserId, supabase]);

  const clearTypingIndicator = useCallback(async () => {
    try {
      await supabase.from('typing_indicators').delete()
        .eq('conversation_id', convId).eq('user_id', currentUserId);
    } catch { /* silent */ }
  }, [convId, currentUserId, supabase]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      sendTypingIndicator();
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      clearTypingIndicator();
    }, TYPING_TIMEOUT);
  }

  // ── Send message — always persists to Supabase ────────────────────────────
  async function handleSend() {
    const text = inputText.trim();
    if (!text && !selectedMedia) return;
    if (sending) return;

    // AI mode
    if (isAiActive && text) {
      setInputText('');
      const optimisticId = `opt-${Date.now()}`;
      const userMsg: Message = {
        id: optimisticId, conversationId: convId, senderId: currentUserId,
        content: text, messageType: 'text', status: 'sent',
        isEdited: false, isDeleted: false, deletedFor: [],
        deletedForSender: false, deletedForReceiver: false, deletedForEveryone: false,
        reactions: {}, createdAt: new Date().toISOString(), isSelf: true,
        deleteAfterMs: MAX_TIMER_MS,
        expiresAt: new Date(Date.now() + MAX_TIMER_MS).toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      aiConversationRef.current = [...aiConversationRef.current, { role: 'user', content: text }];

      const aiMsgId = `ai-${Date.now()}`;
      const aiPlaceholder: Message = {
        id: aiMsgId, conversationId: convId, senderId: otherId,
        content: '', messageType: 'text', status: 'sent',
        isEdited: false, isDeleted: false, deletedFor: [],
        deletedForSender: false, deletedForReceiver: false, deletedForEveryone: false,
        reactions: {}, createdAt: new Date().toISOString(), isSelf: false,
        deleteAfterMs: MAX_TIMER_MS,
        expiresAt: new Date(Date.now() + MAX_TIMER_MS).toISOString(),
      };
      setMessages(prev => [...prev, aiPlaceholder]);
      setAiStreamingMsgId(aiMsgId);

      const apiMessages = [
        { role: 'system' as const, content: `You are a helpful AI assistant integrated into PiChat. Be concise, friendly, and conversational. Keep responses short.` },
        ...aiConversationRef.current,
      ];
      sendAiMessage(apiMessages, { max_completion_tokens: 512 });
      return;
    }

    setSending(true);
    setInputText('');
    const media = selectedMedia;
    setSelectedMedia(null);
    const replyId = replyTo?.id;
    const replySnapshot = replyTo;
    setReplyTo(null);
    clearTypingIndicator();

    const nowTs = Date.now();
    const createdAt = new Date(nowTs).toISOString();
    const expiresAt = new Date(nowTs + MAX_TIMER_MS).toISOString();

    const optimisticId = `opt-${nowTs}`;
    const optimistic: Message = {
      id: optimisticId, conversationId: convId, senderId: currentUserId,
      receiverId: otherId,
      content: text, messageType: media ? 'image' : 'text', mediaUrl: media?.url,
      status: 'sent', isEdited: false, isDeleted: false, deletedFor: [],
      deletedForSender: false, deletedForReceiver: false, deletedForEveryone: false,
      replyToId: replyId,
      replyPreview: replySnapshot ? {
        id: replySnapshot.id, content: replySnapshot.content,
        senderName: replySnapshot.isSelf ? 'You' : conversation.otherUserName,
      } : undefined,
      reactions: {}, createdAt, isSelf: true,
      deleteAfterMs: MAX_TIMER_MS,
      expiresAt,
    };

    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const { data: inserted, error: err } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          sender_id: currentUserId,
          receiver_id: otherId,
          content: text,
          message_type: media ? 'image' : 'text',
          media_url: media?.url || null,
          reply_to_id: replyId || null,
          status: 'sent',
          delete_after_ms: MAX_TIMER_MS,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (err) throw err;

      // Replace optimistic message with real DB row
      const savedMsg = mapRow(inserted, currentUserId, [inserted]);
      setMessages(prev => prev.map(m => m.id === optimisticId ? savedMsg : m));
    } catch {
      // Keep optimistic message visible — mark as sent (may not be saved)
      setMessages(prev => prev.map(m =>
        m.id === optimisticId ? { ...m, status: 'sent' as const } : m
      ));
      setError('Failed to send. Message may not be saved.');
    } finally {
      setSending(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  async function handleEdit(msgId: string, newText: string) {
    try {
      await supabase.from('messages')
        .update({ content: newText, is_edited: true, edited_at: new Date().toISOString() })
        .eq('id', msgId).eq('sender_id', currentUserId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newText, isEdited: true } : m));
    } catch { /* silent */ }
  }

  // ── Delete for me ─────────────────────────────────────────────────────────
  async function handleDeleteForMe(msgId: string) {
    try {
      const msg = messages.find(m => m.id === msgId);
      if (!msg) return;

      if (msg.isSelf) {
        // Sender deleting for themselves
        await supabase.from('messages')
          .update({ deleted_for_sender: true })
          .eq('id', msgId);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deletedForSender: true } : m));
      } else {
        // Receiver deleting for themselves
        await supabase.from('messages')
          .update({ deleted_for_receiver: true })
          .eq('id', msgId);
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deletedForReceiver: true } : m));
      }
    } catch { /* silent */ }
  }

  // ── Delete for everyone ───────────────────────────────────────────────────
  async function handleDeleteForEveryone(msgId: string) {
    try {
      await supabase.from('messages')
        .update({ deleted_for_everyone: true, is_deleted: true, content: '' })
        .eq('id', msgId).eq('sender_id', currentUserId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deletedForEveryone: true, isDeleted: true, content: '' } : m));
    } catch { /* silent */ }
  }

  // ── React ─────────────────────────────────────────────────────────────────
  async function handleReact(msgId: string, emoji: string) {
    try {
      const msg = messages.find(m => m.id === msgId);
      if (!msg) return;
      const existing = (msg.reactions[emoji] as string[]) || [];
      const hasReacted = existing.includes(currentUserId);
      let newReactions: Record<string, string[]>;

      if (hasReacted) {
        await supabase.from('message_reactions').delete()
          .eq('message_id', msgId).eq('user_id', currentUserId).eq('emoji', emoji);
        newReactions = { ...msg.reactions, [emoji]: existing.filter(id => id !== currentUserId) };
      } else {
        await supabase.from('message_reactions').upsert(
          { message_id: msgId, user_id: currentUserId, emoji },
          { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true }
        );
        newReactions = { ...msg.reactions, [emoji]: [...existing, currentUserId] };
      }

      await supabase.from('messages').update({ reactions: newReactions }).eq('id', msgId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m));
    } catch { /* silent */ }
  }

  // ── Long press ────────────────────────────────────────────────────────────
  function handleLongPress(msgId: string, e: React.MouseEvent | React.TouchEvent) {
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setActionPos({ x: rect.left, y: rect.top });
    setActionMsgId(msgId);
    setReactionMsgId(null);
  }

  function jumpToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'rgba(42,171,238,0.15)';
      setTimeout(() => { el.style.background = ''; }, 1500);
    }
  }

  const activeActionMsg = messages.find(m => m.id === actionMsgId);
  const dateGroups = useMemo(() => groupByDate(messages), [messages]);

  const presenceText = otherOnline
    ? 'online'
    : otherLastSeen && otherLastSeen !== 'recently'
    ? `last seen ${new Date(otherLastSeen).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : 'last seen recently';

  return (
    <div
      className="flex flex-col"
      style={{
        background: BG,
        fontFamily: 'Inter, sans-serif',
        height: '100%',
        minHeight: 0,
        flex: '1 1 0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

      {/* Search overlay */}
      {showSearch && (
        <MessageSearch messages={messages} onClose={() => setShowSearch(false)} onJump={jumpToMessage} />
      )}

      {/* Edit modal */}
      {editingMsg && (
        <EditModal message={editingMsg} onSave={text => handleEdit(editingMsg.id, text)} onClose={() => setEditingMsg(null)} />
      )}

      {/* Action menu overlay */}
      {actionMsgId && activeActionMsg && (
        <div className="fixed inset-0 z-30" onClick={() => setActionMsgId(null)}>
          <div
            className="absolute"
            style={{
              top: Math.min(actionPos.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 280),
              left: activeActionMsg.isSelf ? 'auto' : Math.max(8, actionPos.x),
              right: activeActionMsg.isSelf ? 8 : 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <MessageActionMenu
              isSelf={activeActionMsg.isSelf}
              onClose={() => setActionMsgId(null)}
              onCopy={() => { if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(activeActionMsg.content); }}
              onReact={() => { setReactionMsgId(actionMsgId); setActionMsgId(null); }}
              onReply={() => { setReplyTo(activeActionMsg); setActionMsgId(null); inputRef.current?.focus(); }}
              onEdit={activeActionMsg.isSelf ? () => { setEditingMsg(activeActionMsg); setActionMsgId(null); } : undefined}
              onDeleteForMe={() => handleDeleteForMe(actionMsgId)}
              onDeleteForEveryone={activeActionMsg.isSelf ? () => handleDeleteForEveryone(actionMsgId) : undefined}
            />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 relative shrink-0"
        style={{ background: HEADER_BG, borderBottom: `0.7px solid ${DIVIDER}`, zIndex: 40, minHeight: '56px', flexShrink: 0 }}
      >
        <button onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8 shrink-0"
          style={{ color: TEXT_PRIMARY }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm"
              style={{ background: conversation.avatarColor }}>
              {conversation.otherUserAvatar ? (
                <AppImage src={conversation.otherUserAvatar} alt={conversation.otherUserName} width={36} height={36} className="w-full h-full object-cover" />
              ) : <span>{conversation.otherUserName?.charAt(0)?.toUpperCase()}</span>}
            </div>
            {otherOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: ONLINE_GREEN, borderColor: HEADER_BG }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p style={{ fontSize: '15px', fontWeight: 500, color: TEXT_PRIMARY, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {conversation.otherUserName}
              </p>
              {conversation.otherUserVerified && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill={PICHAT_BLUE} className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="white" strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
            <p className="text-[10px] leading-tight" style={{ color: isAiActive ? PICHAT_BLUE : otherOnline ? ONLINE_GREEN : TEXT_MUTED }}>
              {isAiActive ? 'AI mode active · powered by OpenAI' : presenceText}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => setShowSearch(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
            style={{ color: TEXT_MUTED }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          <button
            className="flex items-center gap-1 px-2 h-8 rounded-full transition-colors hover:bg-white/8"
            style={{ color: TEXT_MUTED }}
            aria-label="Call"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012 .01h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 500, color: TEXT_MUTED, letterSpacing: '0.01em' }}>Call</span>
          </button>

          <button onClick={() => setShowMoreMenu(m => !m)}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/8"
            style={{ color: TEXT_MUTED }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="5" r="1.3" fill="currentColor" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" />
              <circle cx="12" cy="19" r="1.3" fill="currentColor" />
            </svg>
          </button>
        </div>

        {showMoreMenu && (
          <MoreMenu
            onClose={() => setShowMoreMenu(false)}
            onClearChat={() => setMessages([])}
            chatName={conversation.otherUserName}
          />
        )}
      </div>

      {/* ── Messages ── */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: '1 1 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          background: BG,
          ...DOT_BG,
          paddingLeft: '10px',
          paddingRight: '10px',
          paddingTop: '12px',
          paddingBottom: '12px',
        }}
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: PICHAT_BLUE, borderTopColor: 'transparent' }} />
          </div>
        )}

        <div className="flex items-center justify-center my-3">
          <span className="px-4 py-1"
            style={{ background: DATE_SEP_BG, border: `0.7px solid ${DATE_SEP_BORDER}`, borderRadius: '2px', backdropFilter: 'blur(8px)', color: TEXT_MUTED, fontSize: '10.5px', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.4 }}>
            Today
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                <div className="rounded-xl" style={{ width: `${140 + (i * 17) % 80}px`, height: '36px', background: i % 2 === 0 ? INCOMING_BG : 'rgba(26,143,204,0.3)' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm" style={{ color: TEXT_MUTED }}>{error}</p>
            <button onClick={() => { setError(null); loadMessages(0); }}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: PICHAT_BLUE }}>Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PICHAT_BLUE} strokeWidth="1.5" opacity="0.7">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Say hello to {conversation.otherUserName}</p>
              <p className="text-xs" style={{ color: TEXT_MUTED }}>Start the conversation</p>
            </div>
          </div>
        ) : (
          dateGroups.map(group => (
            <div key={group.date}>
              <div className="flex items-center justify-center my-3">
                <span className="text-[11px] px-3 py-1"
                  style={{ background: DATE_SEP_BG, color: TEXT_MUTED, border: `0.7px solid ${DATE_SEP_BORDER}`, borderRadius: '2px' }}>
                  {formatDateSep(group.date)}
                </span>
              </div>
              {group.messages.map(msg => (
                <div key={msg.id} id={`msg-${msg.id}`} style={{ transition: 'background 0.3s' }}>
                  <MessageBubble
                    msg={msg}
                    currentUserId={currentUserId}
                    onLongPress={handleLongPress}
                    showReactionPicker={reactionMsgId === msg.id}
                    onReact={emoji => handleReact(msg.id, emoji)}
                    onCloseReactionPicker={() => setReactionMsgId(null)}
                    now={now}
                  />
                </div>
              ))}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {otherTyping && (
          <div className="flex items-end gap-2 mt-2">
            <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: conversation.avatarColor }}>
              {conversation.otherUserName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="px-3 py-2.5 flex items-center gap-1"
              style={{ background: INCOMING_BG, border: `0.7px solid ${INCOMING_BORDER}`, borderRadius: '2px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: TEXT_MUTED, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* AI streaming indicator */}
        {aiLoading && aiStreamingMsgId && messages.find(m => m.id === aiStreamingMsgId)?.content === '' && (
          <div className="flex items-end gap-2 mt-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0" style={{ background: PICHAT_BLUE }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 64 64">
                <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
              </svg>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-1"
              style={{ background: INCOMING_BG, border: `0.7px solid ${INCOMING_BORDER}`, borderRadius: '2px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: PICHAT_BLUE, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 shrink-0"
          style={{ background: HEADER_BG, borderTop: `1px solid ${DIVIDER}` }}>
          <div className="flex-1 min-w-0 border-l-2 pl-2" style={{ borderLeftColor: PICHAT_BLUE }}>
            <p className="text-xs font-semibold" style={{ color: PICHAT_BLUE }}>
              {replyTo.isSelf ? 'You' : conversation.otherUserName}
            </p>
            <p className="text-xs truncate" style={{ color: TEXT_MUTED }}>{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ color: TEXT_MUTED }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Composer ── */}
      <div
        className="flex flex-col px-3 pt-3 pb-3"
        style={{
          background: COMPOSER_BG,
          borderTop: isAiActive ? `0.7px solid ${PICHAT_BLUE}40` : `0.7px solid ${COMPOSER_BORDER}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'border-color 300ms ease',
          flexShrink: 0,
        }}
      >
        {/* Media preview */}
        {selectedMedia && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 rounded overflow-hidden shrink-0">
              <AppImage src={selectedMedia.url} alt="Selected" width={48} height={48} className="w-full h-full object-cover" />
            </div>
            <p className="text-xs flex-1" style={{ color: TEXT_MUTED }}>
              {uploadingMedia ? 'Uploading…' : 'Ready to send'}
            </p>
            <button onClick={() => setSelectedMedia(null)} style={{ color: TEXT_MUTED }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Recording indicator */}
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
              <path d="M 18 21 H 46 M 24 21 V 45 M 40 21 V 45" fill="none" stroke={PICHAT_BLUE} strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
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

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={isAiActive ? 'Ask AI anything…' : 'Type a message…'}
          rows={1}
          className="w-full bg-transparent resize-none outline-none leading-relaxed py-1"
          style={{ color: TEXT_PRIMARY, caretColor: isAiActive ? PICHAT_BLUE : OUTGOING_BG, fontSize: '15px', fontWeight: 400, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}
        />

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.12)', marginTop: '10px', marginBottom: '10px' }} />

        {/* Footer icons row */}
        <div className="flex items-center justify-between px-1" style={{ position: 'relative' }}>

          {/* Attachment menu popup */}
          {showAttachMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowAttachMenu(false)} />
              <div style={{
                position: 'absolute', bottom: '44px', left: '0',
                background: ACTION_MENU_BG, border: `0.7px solid ${ACTION_MENU_BORDER}`,
                borderRadius: '2px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 50, minWidth: '160px',
              }}>
                <button onClick={() => { photoInputRef.current?.click(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: TEXT_PRIMARY }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                  </svg>
                  Photo
                </button>
                <div style={{ height: '0.7px', background: DIVIDER }} />
                <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: TEXT_PRIMARY }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  File
                </button>
              </div>
            </>
          )}

          {/* 1. Plus */}
          <FooterIconButton onClick={() => setShowAttachMenu(p => !p)} aria-label="Attach">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </FooterIconButton>

          {/* 2. AI Assistant */}
          <button
            onClick={() => { const next = !isAiActive; setIsAiActive(next); if (!next) aiConversationRef.current = []; }}
            aria-label="AI Assistant"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', minWidth: '36px', minHeight: '36px',
              borderRadius: '2px', background: '#000000', border: 'none', padding: 0,
              flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg viewBox="150 280 724 1000" width="31" height="31" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
              <path transform="translate(506,329)" d="m0 0h11l16 3 17 8 24 14 24 13 21 12 26 15 28 16 25 14 24 14 27 15 24 14 25 14 35 20 10 8 7 7 8 13 5 13 2 13v351l-4 16-8 15-9 10-7 6-26 15-21 12-26 15-25 14-26 15-25 14-19 11-21 12-23 13-24 14-41 23-22 12-13 4-5 1h-19l-15-4-16-8-24-14-23-13-52-30-56-32-24-14-25-14-17-10-28-16-24-14-11-7-10-9-7-10-6-12-3-12-1-7v-348l3-15 5-12 7-11 11-11 13-8 23-13 28-16 24-14 25-14 17-10 25-14 26-15 25-14 24-14 27-15 23-13 16-9 13-5zm1 33-13 4-25 14-18 10-105 60-27 15-17 10-23 13-24 14-25 14-19 11-9 7-6 8-4 10-1 6v342l3 11 5 9 6 7 15 9 56 32 19 11 28 16 23 13 21 12 24 14 25 14 17 10 49 28 14 7 8 2h14l12-4 26-14 21-12 25-14 22-13 23-13 21-12 23-13 26-15 25-14 24-14 27-15 22-13 10-9 6-10 2-9v-345l-4-13-6-8-8-7-28-16-23-13-21-12-23-13-28-16-23-13-56-32-25-14-21-12-25-14-16-9-8-2z" fill="#FEFEFE"/>
              <path transform="translate(515,518)" d="m0 0h35l27 3 19 4 27 9 25 12 15 10 11 9 10 9 11 12 11 16 10 19 6 16 5 21 2 13 1 12v28l-3 25-6 24-8 18-7 13-11 14-13 13-13 9-17 8-17 5-9 1h-11l-14-2-13-5-11-8-8-11-4-9-1-5-8 11-7 7-10 7-14 7-18 5-7 1h-20l-15-3-15-6-10-6-10-9-8-8-8-13-6-14-4-20v-35l3-18 7-21 9-17 8-11 11-13 13-11 13-8 17-8 19-5 8-1h21l14 3 12 5 11 8 9 10 1 4h2l1-10 4-17h48l-1 10-9 50-16 90-1 12 1 14 3 7 4 3 7 2h7l12-3 12-7 9-9 9-14 7-16 6-20 3-16 1-9v-32l-3-21-5-17-7-16-8-14-9-11-13-13-15-10-17-9-19-7-18-4-12-2-13-1h-27l-21 2-22 5-21 7-19 9-16 10-14 11-13 12-12 14-10 15-9 17-9 25-5 23-2 18v31l3 22 5 21 5 15 12 23 12 16 12 13 14 11 15 9 16 8 24 8 23 4 12 1h27l21-2 19-4 20-6 20-9 12-7h3l11 24 2 7-15 9-25 10-24 7-22 4-22 2h-25l-22-2-26-5-20-6-21-8-20-10-11-7-14-10-14-12-12-12-10-13-11-18-10-21-6-19-5-24-2-23v-19l2-25 5-25 9-27 8-16 9-16 12-16 12-14 8-8 8-7 13-10 15-10 18-10 20-9 27-9 23-5z" fill="#FEFEFE"/>
              <path transform="translate(506,329)" d="m0 0h11l16 3 17 8 24 14 24 13 21 12 26 15 28 16 25 14 24 14 27 15 24 14 25 14 35 20 10 8 7 7 8 13 5 13 2 13v351l-4 16-8 15-9 10-7 6-26 15-21 12-26 15-25 14-26 15-25 14-19 11-21 12-23 13-24 14-41 23-22 12-13 4-5 1h-19l-15-4-16-8-24-14-23-13-52-30-56-32-24-14-25-14-17-10-28-16-24-14-11-7-10-9-7-10-6-12-3-12-1-7v-348l3-15 5-12 7-11 11-11 13-8 23-13 28-16 24-14 25-14 17-10 25-14 26-15 25-14 24-14 27-15 23-13 16-9 13-5zm0 14-12 3-16 8-27 15-24 14-27 15-24 14-18 10-49 28-24 14-25 14-21 12-26 15-15 9-10 9-7 9-5 11-2 9v352l3 13 7 13 8 9 15 10 20 11 17 10 26 15 23 13 24 14 20 11 22 13 28 16 23 13 26 15 24 14 21 12 11 5 11 3h16l14-4 19-10 24-14 18-10 24-14 27-15 17-10 25-14 26-15 21-12 23-13 28-16 25-14 18-11 10-9 7-11 4-10 1-5 1-19v-326l-2-15-4-11-6-10-11-11-13-8-27-15-24-14-27-15-26-15-25-14-49-28-46-26-28-16-23-13-11-5-12-3z" fill="#010101"/>
              <path transform="translate(523,645)" d="m0 0h10l14 3 12 7 8 9 5 10 3 11v30l-4 21-5 16-6 14-7 10-6 7-11 8-14 7-11 3h-17l-10-3-10-6-8-9-6-12-3-11-1-7v-25l4-20 6-16 8-14 8-10 8-8 14-9 14-5z" fill="#000000"/>
            </svg>
          </button>

          {/* 3. Camera */}
          <FooterIconButton onClick={() => cameraInputRef.current?.click()} aria-label="Camera">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </FooterIconButton>

          {/* 4. Microphone */}
          <FooterIconButton onClick={handleMicToggle} isActive={isRecording} activeColor="#ef4444" aria-label="Microphone">
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

          {/* 5. Speech-to-text */}
          <FooterIconButton onClick={() => {}} aria-label="Speech to text">
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

          {/* 6. Compass Send Button */}
          <SendButton
            onClick={handleSend}
            disabled={(!inputText.trim() && !selectedMedia) || (isAiActive && aiLoading) || sending}
          />
        </div>
      </div>
    </div>
  );
}