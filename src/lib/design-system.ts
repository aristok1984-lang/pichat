/**
 * PiChat Design System — Shared Tokens & Utilities
 *
 * Single source of truth for design constants used across the entire app.
 * Import from here instead of duplicating values in components.
 *
 * Aligned with PiChat Master Specification v1.0
 */

// ─── Color Palette ────────────────────────────────────────────────────────────
export const COLORS = {
  background: '#0E1621',
  foreground: '#E8EDF2',
  /** Primary blue per spec: #2A97DF → gradient #52C5FC */
  primary: '#2A97DF',
  primaryGradientEnd: '#52C5FC',
  primaryForeground: '#ffffff',
  secondary: '#17212B',
  secondaryForeground: '#E8EDF2',
  accent: '#8B5CF6',
  accentForeground: '#ffffff',
  /** Dark UI base per spec: #0E1621 */
  muted: '#242F3D',
  mutedForeground: '#7C8FA3',
  /** Secondary bubble per spec: #242F3C */
  card: '#17212B',
  cardForeground: '#E8EDF2',
  border: '#2A3A4A',
  input: '#1C2B3A',
  ring: '#2A97DF',
  online: '#4CAF7D',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  /** Light gray per spec */
  lightGray: '#D7DDE5',
  /** Warm white per spec */
  warmWhite: '#F5F4F1',
} as const;

// ─── Avatar Colors ────────────────────────────────────────────────────────────
export const AVATAR_COLORS = [
  '#2A97DF',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
] as const;

export function getAvatarColor(seed: string): string {
  const idx = (seed?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Community Colors ─────────────────────────────────────────────────────────
export const COMMUNITY_COLORS = [
  '#2A97DF',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
] as const;

export function getCommunityColor(seed: string): string {
  const idx = (seed?.charCodeAt(0) || 0) % COMMUNITY_COLORS.length;
  return COMMUNITY_COLORS[idx];
}

// ─── Border Radius ────────────────────────────────────────────────────────────
/**
 * PiChat 2px Radius Language — LOCKED per Master Specification v1.0
 * "2px Radius Language" is a locked design decision.
 */
export const RADIUS = {
  /** PiChat signature radius — 2px (locked) */
  base: '2px',
  sm: '2px',
  md: '2px',
  lg: '2px',
  xl: '2px',
  '2xl': '2px',
  full: '9999px',
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const SPACING = {
  pagePadding: '16px',
  cardPadding: '16px',
  sectionGap: '12px',
  itemGap: '8px',
  headerHeight: '56px',
  bottomNavHeight: '88px',
  statusBarHeight: '44px',
  /** Message bubble screen edge spacing per spec */
  bubbleEdge: '10px',
  bubbleAvatar: '10px',
  bubbleGap: '10px',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
/**
 * Typography per PiChat Master Specification v1.0:
 * - Primary Font: Inter
 * - Logo Font: League Spartan
 * - Message Text: 15px
 * - Headers: 15-16px
 * - Stats: 22px
 * - Timestamp: 10.5px
 * - Labels: 10.5px uppercase
 */
export const TYPOGRAPHY = {
  fontSans: "var(--font-inter), 'Inter', var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif",
  fontLogo: "var(--font-league-spartan), 'League Spartan', sans-serif",
  sizes: {
    /** Labels, timestamps per spec */
    xs: '10.5px',
    sm: '13px',
    /** Message text, base per spec */
    base: '15px',
    /** Headers per spec */
    lg: '15px',
    xl: '16px',
    /** Stats per spec */
    stats: '22px',
    '2xl': '20px',
    '3xl': '24px',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

// ─── Animation Timing ─────────────────────────────────────────────────────────
export const ANIMATION = {
  fast: '0.15s ease',
  base: '0.2s ease',
  slow: '0.3s ease',
  spring: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOWS = {
  card: '0 2px 12px rgba(0,0,0,0.3)',
  float: '0 4px 20px rgba(42, 151, 223, 0.4)',
  phone: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.6)',
  messageBubbleOut: '0 2px 10px rgba(42,151,223,0.20)',
} as const;

// ─── Interaction States ───────────────────────────────────────────────────────
export const INTERACTION = {
  hoverBg: 'rgba(42,151,223,0.07)',
  activeBg: 'rgba(42,151,223,0.12)',
  focusRing: '0 0 0 3px rgba(42, 151, 223, 0.12)',
  dangerRing: '0 0 0 3px rgba(239, 68, 68, 0.12)',
} as const;

// ─── Formatters ───────────────────────────────────────────────────────────────
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ─── OAuth Provider Config ────────────────────────────────────────────────────
/**
 * OAuth provider availability flags.
 * Set to `true` when the provider is configured in Supabase Dashboard
 * and ready to be enabled in the UI.
 *
 * Currently only email auth is active.
 * Google and Apple are architecturally prepared — flip the flags to enable.
 */
export const OAUTH_PROVIDERS = {
  google: {
    enabled: false,
    label: 'Google',
    supabaseProvider: 'google' as const,
  },
  apple: {
    enabled: false,
    label: 'Apple',
    supabaseProvider: 'apple' as const,
  },
} as const;

export type OAuthProviderKey = keyof typeof OAUTH_PROVIDERS;
