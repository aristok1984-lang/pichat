'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Community {
  id: string;
  name: string;
  slug: string;
  avatar_url?: string;
}

interface ComposeModalProps {
  onClose: () => void;
  onPosted: () => void;
  userId?: string;
}

type PostType = 'text' | 'image' | 'video' | 'link' | 'poll';

const POST_TYPES: { type: PostType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'text',
    label: 'Text',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    type: 'image',
    label: 'Image',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    type: 'video',
    label: 'Video',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
  },
  {
    type: 'link',
    label: 'Link',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    type: 'poll',
    label: 'Poll',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function ComposeModal({ onClose, onPosted, userId }: ComposeModalProps) {
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();
  const { user } = useAuth();

  useEffect(() => {
    async function fetchCommunities() {
      const { data } = await supabase
        .from('communities')
        .select('id, name, slug, avatar_url')
        .order('members_count', { ascending: false })
        .limit(20);
      if (data) setCommunities(data);
    }
    fetchCommunities();
  }, []);

  function addPollOption() {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, '']);
  }

  function removePollOption(idx: number) {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  }

  function updatePollOption(idx: number, value: string) {
    const updated = [...pollOptions];
    updated[idx] = value;
    setPollOptions(updated);
  }

  async function handlePost() {
    const uid = userId || user?.id;
    if (!uid) return;
    if (!title.trim() && postType !== 'poll') {
      setError('Add a title to your post');
      return;
    }
    if (postType === 'link' && !linkUrl.trim()) {
      setError('Paste a URL for your link post');
      return;
    }
    if (postType === 'poll') {
      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        setError('Add at least 2 poll options');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const tags = (content.match(/#(\w+)/g) || []).map((t: string) => t.slice(1));
      const pollData = postType === 'poll'
        ? pollOptions.filter(o => o.trim()).map(o => ({ text: o.trim(), votes: 0 }))
        : null;

      const { error: postError } = await supabase.from('posts').insert({
        author_id: uid,
        community_id: selectedCommunity?.id || null,
        post_type: postType,
        title: title.trim(),
        content: content.trim(),
        image_url: postType === 'image' ? imageUrl.trim() : '',
        video_url: postType === 'video' ? imageUrl.trim() : '',
        link_url: postType === 'link' ? linkUrl.trim() : '',
        poll_options: pollData,
        tags,
        is_spoiler: isSpoiler,
        allow_comments: allowComments,
      });

      if (postError) { setError(postError.message); return; }
      onPosted();
    } catch (err: any) {
      setError(err?.message || 'Failed to post');
    } finally {
      setLoading(false);
    }
  }

  const canPost = postType === 'poll'
    ? pollOptions.filter(o => o.trim()).length >= 2
    : title.trim().length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full rounded-t-2xl animate-slide-up"
        style={{ background: '#17212B', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}>
          <button onClick={onClose} className="text-sm font-medium" style={{ color: '#7C8FA3' }}>
            Cancel
          </button>
          <h3 className="text-sm font-bold" style={{ color: '#E8EDF2' }}>Create Post</h3>
          <button
            onClick={handlePost}
            disabled={!canPost || loading}
            className="px-4 py-1.5 rounded-full text-sm font-bold transition-all active:scale-95"
            style={{
              background: canPost && !loading ? 'linear-gradient(135deg, #2A97DF, #52C5FC)' : 'rgba(255,255,255,0.08)',
              color: canPost && !loading ? '#fff' : '#7C8FA3',
            }}
          >
            {loading ? 'Posting…' : 'Post'}
          </button>
        </div>

        {/* Post type selector */}
        <div className="flex gap-1 px-4 py-3 overflow-x-auto scrollbar-hide" style={{ borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}>
          {POST_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => setPostType(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all"
              style={{
                background: postType === type ? 'linear-gradient(135deg, #2A97DF, #52C5FC)' : 'rgba(255,255,255,0.06)',
                color: postType === type ? '#fff' : '#7C8FA3',
                border: postType === type ? 'none' : '0.7px solid rgba(42,58,74,0.6)',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Community selector */}
          <div className="relative">
            <button
              onClick={() => setShowCommunityPicker(!showCommunityPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.7px solid rgba(42,58,74,0.7)',
                color: selectedCommunity ? '#E8EDF2' : '#7C8FA3',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span>{selectedCommunity ? `c/${selectedCommunity.name}` : 'Choose community (optional)'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showCommunityPicker && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                style={{ background: '#0E1621', border: '0.7px solid rgba(42,58,74,0.8)', maxHeight: '180px', overflowY: 'auto' }}
              >
                <button
                  onClick={() => { setSelectedCommunity(null); setShowCommunityPicker(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                  style={{ color: '#7C8FA3' }}
                >
                  No community (general post)
                </button>
                {communities.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCommunity(c); setShowCommunityPicker(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                    style={{ color: '#E8EDF2' }}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: '#2A97DF' }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span>c/{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          {postType !== 'poll' && (
            <input
              type="text"
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              className="w-full px-3 py-3 text-sm rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.7px solid rgba(42,58,74,0.7)',
                color: '#E8EDF2',
              }}
            />
          )}

          {/* Body text */}
          {(postType === 'text' || postType === 'image' || postType === 'video') && (
            <textarea
              placeholder="Body text (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-3 text-sm rounded-xl outline-none resize-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.7px solid rgba(42,58,74,0.7)',
                color: '#E8EDF2',
              }}
            />
          )}

          {/* Image/Video URL */}
          {(postType === 'image' || postType === 'video') && (
            <input
              type="url"
              placeholder={postType === 'image' ? 'Image URL' : 'Video URL'}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-3 text-sm rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.7px solid rgba(42,58,74,0.7)',
                color: '#E8EDF2',
              }}
            />
          )}

          {/* Link URL */}
          {postType === 'link' && (
            <>
              <input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.7px solid rgba(42,58,74,0.7)',
                  color: '#E8EDF2',
                }}
              />
              <textarea
                placeholder="Description (optional)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-3 text-sm rounded-xl outline-none resize-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.7px solid rgba(42,58,74,0.7)',
                  color: '#E8EDF2',
                }}
              />
            </>
          )}

          {/* Poll */}
          {postType === 'poll' && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Poll question"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.7px solid rgba(42,58,74,0.7)',
                  color: '#E8EDF2',
                }}
              />
              {pollOptions.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={option}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '0.7px solid rgba(42,58,74,0.7)',
                      color: '#E8EDF2',
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      onClick={() => removePollOption(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-red-500/10"
                      style={{ color: '#EF4444' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 6 && (
                <button
                  onClick={addPollOption}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{ color: '#2A97DF' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add option
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          <input
            type="text"
            placeholder="Add tags with #hashtag"
            value={content.includes('#') ? '' : ''}
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '0.7px solid rgba(42,58,74,0.7)',
              color: '#E8EDF2',
            }}
            readOnly
            onClick={() => {}}
          />

          {/* More options */}
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: '#7C8FA3' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points={showMoreOptions ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
            </svg>
            {showMoreOptions ? 'Less options' : 'More options'}
          </button>

          {showMoreOptions && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm" style={{ color: '#E8EDF2' }}>Mark as spoiler</span>
                <button
                  onClick={() => setIsSpoiler(!isSpoiler)}
                  className="w-10 h-5 rounded-full transition-all relative"
                  style={{ background: isSpoiler ? '#2A97DF' : 'rgba(255,255,255,0.1)' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: isSpoiler ? '22px' : '2px' }}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm" style={{ color: '#E8EDF2' }}>Allow comments</span>
                <button
                  onClick={() => setAllowComments(!allowComments)}
                  className="w-10 h-5 rounded-full transition-all relative"
                  style={{ background: allowComments ? '#2A97DF' : 'rgba(255,255,255,0.1)' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: allowComments ? '22px' : '2px' }}
                  />
                </button>
              </label>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              {error}
            </div>
          )}
        </div>

        {/* Bottom safe area */}
        <div className="h-6" />
      </div>
    </div>
  );
}
