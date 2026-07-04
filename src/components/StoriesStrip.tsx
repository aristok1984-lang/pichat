'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppImage from '@/components/ui/AppImage';

interface StoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  avatarColor: string;
  hasUnread: boolean;
  storyCount: number;
}

interface Story {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  bg_color: string | null;
  created_at: string;
}

const AVATAR_COLORS = ['#2AABEE', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
const STORY_BG_COLORS = [
  '#8B5CF6', '#2AABEE', '#EC4899', '#F59E0B', '#10B981',
  '#EF4444', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

function getAvatarColor(id: string) {
  return AVATAR_COLORS[(id?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Story Viewer ────────────────────────────────────────────────────────────
interface StoryViewerProps {
  group: StoryGroup;
  onClose: () => void;
  currentUserId?: string;
}

function StoryViewer({ group, onClose, currentUserId }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();
  const DURATION = 5000;
  const doneRef = useRef(false);

  useEffect(() => {
    fetchUserStories();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [group.userId]);

  async function fetchUserStories() {
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('stories')
      .select('id, user_id, content, image_url, bg_color, created_at')
      .eq('user_id', group.userId)
      .gt('expires_at', now)
      .order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setStories(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (stories.length === 0 || paused) return;
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stories, currentIndex, paused]);

  useEffect(() => {
    if (stories.length > 0 && currentUserId && stories[currentIndex]) {
      recordView(stories[currentIndex].id);
    }
  }, [currentIndex, stories]);

  async function recordView(storyId: string) {
    if (!currentUserId) return;
    await supabase.from('story_views').upsert(
      { story_id: storyId, viewer_id: currentUserId },
      { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
    );
  }

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const step = 100 / (DURATION / 100);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goNext();
          return 0;
        }
        return prev + step;
      });
    }, 100);
  }

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev + 1 >= stories.length) {
        doneRef.current = true;
        return prev;
      }
      doneRef.current = false;
      return prev + 1;
    });
  }, [stories.length]);

  useEffect(() => {
    if (doneRef.current) {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const current = stories[currentIndex];
  const bgColor = current?.bg_color || '#8B5CF6';

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div
        className="relative flex-1 flex flex-col"
        style={{ background: current?.image_url ? '#000' : bgColor }}
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {current?.image_url && (
          <AppImage
            src={current.image_url}
            alt="Story"
            fill
            className="object-cover"
          />
        )}

        {/* Overlay gradient top */}
        <div className="absolute inset-x-0 top-0 h-24 z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }} />

        {/* Progress bars */}
        <div className="absolute top-3 inset-x-3 z-20 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.35)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: 'white',
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                  transition: i === currentIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 inset-x-3 z-20 flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: group.avatarColor, border: '2px solid rgba(255,255,255,0.6)' }}
            >
              {group.avatarUrl ? (
                <AppImage src={group.avatarUrl} alt={group.displayName} width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                group.displayName?.charAt(0) || '?'
              )}
            </div>
            <div>
              <p className="text-white text-xs font-semibold leading-tight">{group.displayName}</p>
              {current && (
                <p className="text-white/70 text-[10px]">{timeAgo(current.created_at)}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Story content text */}
        {current?.content && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <p className="text-white text-xl font-semibold text-center leading-snug drop-shadow-lg">
              {current.content}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 z-20 flex">
          <div className="flex-1" onClick={goPrev} />
          <div className="flex-1" onClick={goNext} />
        </div>
      </div>
    </div>
  );
}

// ─── Create Story Modal ───────────────────────────────────────────────────────
interface CreateStoryModalProps {
  myProfile: any;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
}

function CreateStoryModal({ myProfile, onClose, onCreated, userId }: CreateStoryModalProps) {
  const [storyText, setStoryText] = useState('');
  const [selectedColor, setSelectedColor] = useState(STORY_BG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  async function handleCreate() {
    if (!storyText.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('stories').insert({
        user_id: userId,
        content: storyText.trim(),
        bg_color: selectedColor,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post story');
    } finally {
      setCreating(false);
    }
  }

  const myInitial = myProfile?.display_name?.charAt(0)?.toUpperCase() || myProfile?.username?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: selectedColor }}>
      {/* Preview area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-10 pb-4">
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(0,0,0,0.25)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)' }}
            >
              {myProfile?.avatar_url ? (
                <AppImage src={myProfile.avatar_url} alt="Me" width={32} height={32} className="w-full h-full object-cover rounded-full" />
              ) : myInitial}
            </div>
            <span className="text-white text-sm font-semibold">Your Story</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Text preview */}
        <div className="flex-1 flex items-center justify-center px-8">
          {storyText ? (
            <p className="text-white text-2xl font-bold text-center leading-snug drop-shadow-lg">
              {storyText}
            </p>
          ) : (
            <p className="text-white/40 text-lg text-center">Your story preview…</p>
          )}
        </div>

        {/* Color picker */}
        <div className="flex gap-2 px-4 pb-4 justify-center">
          {STORY_BG_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className="w-7 h-7 rounded-full transition-transform"
              style={{
                background: color,
                border: selectedColor === color ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                transform: selectedColor === color ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom input */}
      <div className="px-4 pb-6 pt-3" style={{ background: 'rgba(0,0,0,0.35)' }}>
        {error && (
          <p className="text-red-300 text-xs mb-2 text-center">{error}</p>
        )}
        <div className="flex items-end gap-3">
          <textarea
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            placeholder="What's on your mind?"
            rows={2}
            maxLength={200}
            className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!storyText.trim() || creating}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all"
            style={{
              background: storyText.trim() ? 'white' : 'rgba(255,255,255,0.25)',
            }}
          >
            {creating ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={storyText.trim() ? selectedColor : 'rgba(255,255,255,0.5)'} strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill={storyText.trim() ? selectedColor : 'none'} />
              </svg>
            )}
          </button>
        </div>
        <p className="text-white/40 text-[10px] text-right mt-1">{storyText.length}/200</p>
      </div>
    </div>
  );
}

// ─── StoriesStrip ─────────────────────────────────────────────────────────────
export default function StoriesStrip() {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    fetchStories();
    if (user) fetchMyProfile();
  }, [user]);

  async function fetchMyProfile() {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setMyProfile(data);
  }

  async function fetchStories() {
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('stories')
        .select('id, user_id, content, image_url, bg_color, created_at, user_profiles:user_id(username, display_name, avatar_url)')
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) return;

      const groupMap = new Map<string, StoryGroup>();
      for (const story of data) {
        const profile = story.user_profiles as any;
        if (!profile) continue;
        if (!groupMap.has(story.user_id)) {
          groupMap.set(story.user_id, {
            userId: story.user_id,
            username: profile.username || '',
            displayName: profile.display_name || profile.username || '',
            avatarUrl: profile.avatar_url || '',
            avatarColor: getAvatarColor(story.user_id),
            hasUnread: true,
            storyCount: 1,
          });
        } else {
          const existing = groupMap.get(story.user_id)!;
          groupMap.set(story.user_id, { ...existing, storyCount: existing.storyCount + 1 });
        }
      }

      if (user) groupMap.delete(user.id);
      setStoryGroups(Array.from(groupMap.values()));
    } catch {
      // silent
    }
  }

  const myInitial = myProfile?.display_name?.charAt(0)?.toUpperCase() || myProfile?.username?.charAt(0)?.toUpperCase() || (user ? 'U' : 'A');

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* My story */}
        <button
          onClick={() => setShowCreateStory(true)}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative">
            <div
              className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold text-white"
              style={{ background: 'var(--primary)', border: '2px solid var(--border)' }}
            >
              {myProfile?.avatar_url ? (
                <AppImage src={myProfile.avatar_url} alt="My story" width={56} height={56} className="w-full h-full object-cover" />
              ) : (
                myInitial
              )}
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'var(--primary)', border: '2px solid var(--secondary)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-medium truncate w-14 text-center">My Story</span>
        </button>

        {/* Contact stories */}
        {storyGroups.map((group) => (
          <button
            key={`story-${group.userId}`}
            className="flex flex-col items-center gap-1.5 shrink-0"
            onClick={() => setViewingGroup(group)}
          >
            <div className={group.hasUnread ? 'story-ring-active story-pulse' : 'story-ring-seen'}>
              <div className="w-12 h-12 rounded-full overflow-hidden p-0.5" style={{ background: 'var(--secondary)' }}>
                {group.avatarUrl ? (
                  <AppImage
                    src={group.avatarUrl}
                    alt={`${group.displayName}'s story`}
                    width={48}
                    height={48}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: group.avatarColor }}
                  >
                    {group.displayName?.charAt(0) || '?'}
                  </div>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-medium truncate w-14 text-center">
              {group.displayName?.split(' ')?.[0] || group.username}
            </span>
          </button>
        ))}
      </div>

      {/* Story Viewer */}
      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          onClose={() => { setViewingGroup(null); fetchStories(); }}
          currentUserId={user?.id}
        />
      )}

      {/* Create Story Modal */}
      {showCreateStory && user && (
        <CreateStoryModal
          myProfile={myProfile}
          userId={user.id}
          onClose={() => setShowCreateStory(false)}
          onCreated={fetchStories}
        />
      )}
    </>
  );
}