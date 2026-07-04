'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobileFrame from '@/components/MobileFrame';
import BottomNav from '@/components/BottomNav';
import StatusBarTime from '@/components/StatusBarTime';

interface Community {
  id: string;
  name: string;
  slug: string;
  avatar_url?: string;
}

type PostType = 'text' | 'image' | 'video' | 'link' | 'poll';

const POST_TYPES: { type: PostType; label: string; emoji: string }[] = [
  { type: 'text', label: 'Text', emoji: '📝' },
  { type: 'image', label: 'Image', emoji: '🖼️' },
  { type: 'video', label: 'Video', emoji: '🎬' },
  { type: 'link', label: 'Link', emoji: '🔗' },
  { type: 'poll', label: 'Poll', emoji: '📊' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  // Form state
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [tags, setTags] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [allowComments, setAllowComments] = useState(true);

  // UI state
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const communityPickerRef = useRef<HTMLDivElement>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (user === null) {
      router.replace('/sign-up-login-screen');
    }
  }, [user, router]);

  // Fetch communities
  useEffect(() => {
    async function fetchCommunities() {
      const { data } = await supabase
        .from('communities')
        .select('id, name, slug, avatar_url')
        .order('members_count', { ascending: false })
        .limit(50);
      if (data) setCommunities(data);
    }
    fetchCommunities();
  }, []);

  // Close community picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (communityPickerRef.current && !communityPickerRef.current.contains(e.target as Node)) {
        setShowCommunityPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!selectedCommunity) {
      errors.community = 'Please select a community before posting.';
    }

    if (postType === 'poll') {
      if (!pollQuestion.trim()) {
        errors.pollQuestion = 'Poll question is required.';
      }
      const validOptions = pollOptions.filter(o => o.trim());
      if (validOptions.length < 2) {
        errors.pollOptions = 'Add at least 2 poll options.';
      }
    } else {
      if (!title.trim()) {
        errors.title = 'Title is required.';
      }
      if (postType === 'link' && !linkUrl.trim()) {
        errors.linkUrl = 'A URL is required for link posts.';
      }
      if (postType === 'image' && !imageUrl.trim()) {
        errors.imageUrl = 'An image URL is required for image posts.';
      }
      if (postType === 'video' && !videoUrl.trim()) {
        errors.videoUrl = 'A video URL is required for video posts.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!user) {
      router.replace('/sign-up-login-screen');
      return;
    }

    if (!validate()) return;

    setLoading(true);
    setSubmitError('');

    try {
      // Parse tags from comma-separated or #hashtag format
      const parsedTags = tags
        .split(/[\s,]+/)
        .map(t => t.replace(/^#/, '').trim().toLowerCase())
        .filter(t => t.length > 0);

      // Also extract inline hashtags from content
      const inlineTags = (content.match(/#(\w+)/g) || []).map(t => t.slice(1).toLowerCase());
      const allTags = Array.from(new Set([...parsedTags, ...inlineTags]));

      const pollData =
        postType === 'poll'
          ? pollOptions.filter(o => o.trim()).map(o => ({ text: o.trim(), votes: 0 }))
          : null;

      const postPayload: Record<string, any> = {
        author_id: user.id,
        community_id: selectedCommunity!.id,
        post_type: postType,
        title: postType === 'poll' ? pollQuestion.trim() : title.trim(),
        content: content.trim(),
        tags: allTags,
        is_spoiler: isSpoiler,
        allow_comments: allowComments,
        image_url: postType === 'image' ? imageUrl.trim() : '',
        video_url: postType === 'video' ? videoUrl.trim() : '',
        link_url: postType === 'link' ? linkUrl.trim() : '',
        poll_options: pollData,
      };

      const { error: insertError } = await supabase.from('posts').insert(postPayload);

      if (insertError) {
        setSubmitError(insertError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Redirect to feed after short success display
      setTimeout(() => {
        router.push('/social-feed');
      }, 1200);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to create post. Please try again.');
      setLoading(false);
    }
  }

  const canSubmit =
    !loading &&
    !success &&
    !!selectedCommunity &&
    (postType === 'poll'
      ? pollQuestion.trim().length > 0 && pollOptions.filter(o => o.trim()).length >= 2
      : title.trim().length > 0);

  if (!user) return null;

  return (
    <div className="min-h-screen gradient-brand flex items-center justify-center p-4 md:p-8">
      <MobileFrame>
        {/* Status bar */}
        <div className="status-bar">
          <StatusBarTime />
          <div className="flex items-center gap-1.5">
            <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" className="text-foreground">
              <rect x="0" y="4" width="3" height="7" rx="0.5" opacity="0.4" />
              <rect x="4" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.6" />
              <rect x="8" y="1" width="3" height="10" rx="0.5" opacity="0.8" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0E1621' }}>
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: '#17212B', borderBottom: '0.7px solid rgba(42,58,74,0.8)' }}
          >
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm font-medium transition-opacity active:opacity-60"
              style={{ color: '#7C8FA3' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <h1 className="text-sm font-bold" style={{ color: '#E8EDF2' }}>
              Create Post
            </h1>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-full text-sm font-bold transition-all active:scale-95"
              style={{
                background: canSubmit
                  ? 'linear-gradient(135deg, #2A97DF, #52C5FC)'
                  : 'rgba(255,255,255,0.08)',
                color: canSubmit ? '#fff' : '#7C8FA3',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'Posting…' : success ? '✓ Posted!' : 'Post'}
            </button>
          </div>

          {/* Success banner */}
          {success && (
            <div
              className="mx-4 mt-3 px-4 py-3 rounded-xl text-sm font-semibold text-center animate-fade-in"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '0.7px solid rgba(16,185,129,0.3)' }}
            >
              ✓ Post created! Redirecting to feed…
            </div>
          )}

          {/* Error banner */}
          {submitError && (
            <div
              className="mx-4 mt-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '0.7px solid rgba(239,68,68,0.25)' }}
            >
              {submitError}
            </div>
          )}

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
            {/* Post type selector */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                POST TYPE
              </label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {POST_TYPES.map(({ type, label, emoji }) => (
                  <button
                    key={type}
                    onClick={() => {
                      setPostType(type);
                      setFieldErrors({});
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all"
                    style={{
                      background:
                        postType === type
                          ? 'linear-gradient(135deg, rgba(42,151,223,0.25), rgba(82,197,252,0.15))'
                          : 'rgba(255,255,255,0.05)',
                      color: postType === type ? '#52C5FC' : '#7C8FA3',
                      border:
                        postType === type
                          ? '0.7px solid rgba(42,151,223,0.5)'
                          : '0.7px solid rgba(42,58,74,0.6)',
                    }}
                  >
                    <span>{emoji}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Community selector — REQUIRED */}
            <div ref={communityPickerRef} className="relative">
              <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                COMMUNITY <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <button
                onClick={() => setShowCommunityPicker(!showCommunityPicker)}
                className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm transition-all text-left"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: fieldErrors.community
                    ? '0.7px solid rgba(239,68,68,0.6)'
                    : '0.7px solid rgba(42,58,74,0.7)',
                  color: selectedCommunity ? '#E8EDF2' : '#7C8FA3',
                }}
              >
                {selectedCommunity ? (
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, #2A97DF, #52C5FC)' }}
                    >
                      {selectedCommunity.name.charAt(0).toUpperCase()}
                    </div>
                    <span>c/{selectedCommunity.name}</span>
                  </div>
                ) : (
                  <span className="flex-1">Select a community…</span>
                )}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ color: '#7C8FA3', transform: showCommunityPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {fieldErrors.community && (
                <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
                  {fieldErrors.community}
                </p>
              )}

              {showCommunityPicker && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                  style={{
                    background: '#17212B',
                    border: '0.7px solid rgba(42,58,74,0.8)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {communities.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-center" style={{ color: '#7C8FA3' }}>
                      No communities found
                    </div>
                  ) : (
                    communities.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCommunity(c);
                          setShowCommunityPicker(false);
                          setFieldErrors(prev => ({ ...prev, community: '' }));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
                        style={{
                          color: '#E8EDF2',
                          background: selectedCommunity?.id === c.id ? 'rgba(42,151,223,0.1)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #2A97DF, #52C5FC)' }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ fontSize: '13px' }}>
                            c/{c.name}
                          </div>
                        </div>
                        {selectedCommunity?.id === c.id && (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#2A97DF"
                            strokeWidth="2.5"
                            className="ml-auto"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Title (all types except poll) */}
            {postType !== 'poll' && (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                  TITLE <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Give your post a title…"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: '' }));
                  }}
                  maxLength={300}
                  className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: fieldErrors.title
                      ? '0.7px solid rgba(239,68,68,0.6)'
                      : '0.7px solid rgba(42,58,74,0.7)',
                    color: '#E8EDF2',
                  }}
                />
                <div className="flex justify-between mt-1">
                  {fieldErrors.title ? (
                    <p className="text-xs" style={{ color: '#EF4444' }}>
                      {fieldErrors.title}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs" style={{ color: '#7C8FA3' }}>
                    {title.length}/300
                  </span>
                </div>
              </div>
            )}

            {/* Body text (text, image, video) */}
            {(postType === 'text' || postType === 'image' || postType === 'video') && (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                  BODY <span style={{ color: '#7C8FA3', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  placeholder="Share your thoughts…"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-3 text-sm rounded-xl outline-none resize-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '0.7px solid rgba(42,58,74,0.7)',
                    color: '#E8EDF2',
                  }}
                />
              </div>
            )}

            {/* Image URL */}
            {postType === 'image' && (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                  IMAGE URL <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={e => {
                    setImageUrl(e.target.value);
                    if (fieldErrors.imageUrl) setFieldErrors(prev => ({ ...prev, imageUrl: '' }));
                  }}
                  className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: fieldErrors.imageUrl
                      ? '0.7px solid rgba(239,68,68,0.6)'
                      : '0.7px solid rgba(42,58,74,0.7)',
                    color: '#E8EDF2',
                  }}
                />
                {fieldErrors.imageUrl && (
                  <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
                    {fieldErrors.imageUrl}
                  </p>
                )}
                {imageUrl && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ maxHeight: '160px' }}>
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full object-cover"
                      style={{ maxHeight: '160px' }}
                      onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Video URL */}
            {postType === 'video' && (
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                  VIDEO URL <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={videoUrl}
                  onChange={e => {
                    setVideoUrl(e.target.value);
                    if (fieldErrors.videoUrl) setFieldErrors(prev => ({ ...prev, videoUrl: '' }));
                  }}
                  className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: fieldErrors.videoUrl
                      ? '0.7px solid rgba(239,68,68,0.6)'
                      : '0.7px solid rgba(42,58,74,0.7)',
                    color: '#E8EDF2',
                  }}
                />
                {fieldErrors.videoUrl && (
                  <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
                    {fieldErrors.videoUrl}
                  </p>
                )}
              </div>
            )}

            {/* Link URL + description */}
            {postType === 'link' && (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                    URL <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={e => {
                      setLinkUrl(e.target.value);
                      if (fieldErrors.linkUrl) setFieldErrors(prev => ({ ...prev, linkUrl: '' }));
                    }}
                    className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: fieldErrors.linkUrl
                        ? '0.7px solid rgba(239,68,68,0.6)'
                        : '0.7px solid rgba(42,58,74,0.7)',
                      color: '#E8EDF2',
                    }}
                  />
                  {fieldErrors.linkUrl && (
                    <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
                      {fieldErrors.linkUrl}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                    DESCRIPTION <span style={{ color: '#7C8FA3', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <textarea
                    placeholder="What's this link about?"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-3 text-sm rounded-xl outline-none resize-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '0.7px solid rgba(42,58,74,0.7)',
                      color: '#E8EDF2',
                    }}
                  />
                </div>
              </>
            )}

            {/* Poll */}
            {postType === 'poll' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                    POLL QUESTION <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ask a question…"
                    value={pollQuestion}
                    onChange={e => {
                      setPollQuestion(e.target.value);
                      if (fieldErrors.pollQuestion) setFieldErrors(prev => ({ ...prev, pollQuestion: '' }));
                    }}
                    maxLength={300}
                    className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: fieldErrors.pollQuestion
                        ? '0.7px solid rgba(239,68,68,0.6)'
                        : '0.7px solid rgba(42,58,74,0.7)',
                      color: '#E8EDF2',
                    }}
                  />
                  {fieldErrors.pollQuestion && (
                    <p className="mt-1 text-xs" style={{ color: '#EF4444' }}>
                      {fieldErrors.pollQuestion}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                    OPTIONS <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="space-y-2">
                    {pollOptions.map((option, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Option ${idx + 1}`}
                          value={option}
                          onChange={e => {
                            updatePollOption(idx, e.target.value);
                            if (fieldErrors.pollOptions) setFieldErrors(prev => ({ ...prev, pollOptions: '' }));
                          }}
                          className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: fieldErrors.pollOptions
                              ? '0.7px solid rgba(239,68,68,0.6)'
                              : '0.7px solid rgba(42,58,74,0.7)',
                            color: '#E8EDF2',
                          }}
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => removePollOption(idx)}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {fieldErrors.pollOptions && (
                      <p className="text-xs" style={{ color: '#EF4444' }}>
                        {fieldErrors.pollOptions}
                      </p>
                    )}
                    {pollOptions.length < 6 && (
                      <button
                        onClick={addPollOption}
                        className="flex items-center gap-1.5 text-sm font-medium mt-1 transition-opacity active:opacity-60"
                        style={{ color: '#2A97DF' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add option ({pollOptions.length}/6)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#7C8FA3' }}>
                TAGS <span style={{ color: '#7C8FA3', fontWeight: 400 }}>(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                placeholder="technology, design, gaming…"
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full px-3 py-3 text-sm rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '0.7px solid rgba(42,58,74,0.7)',
                  color: '#E8EDF2',
                }}
              />
            </div>

            {/* More options */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '0.7px solid rgba(42,58,74,0.6)', background: 'rgba(255,255,255,0.03)' }}
            >
              <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
                <div>
                  <span className="text-sm font-medium" style={{ color: '#E8EDF2' }}>
                    Mark as spoiler
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: '#7C8FA3' }}>
                    Content will be blurred until revealed
                  </p>
                </div>
                <button
                  onClick={() => setIsSpoiler(!isSpoiler)}
                  className="w-11 h-6 rounded-full transition-all relative shrink-0"
                  style={{ background: isSpoiler ? '#2A97DF' : 'rgba(255,255,255,0.12)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
                    style={{ left: isSpoiler ? '22px' : '2px' }}
                  />
                </button>
              </label>
              <div style={{ height: '0.7px', background: 'rgba(42,58,74,0.5)' }} />
              <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
                <div>
                  <span className="text-sm font-medium" style={{ color: '#E8EDF2' }}>
                    Allow comments
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: '#7C8FA3' }}>
                    Let others comment on this post
                  </p>
                </div>
                <button
                  onClick={() => setAllowComments(!allowComments)}
                  className="w-11 h-6 rounded-full transition-all relative shrink-0"
                  style={{ background: allowComments ? '#2A97DF' : 'rgba(255,255,255,0.12)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-sm"
                    style={{ left: allowComments ? '22px' : '2px' }}
                  />
                </button>
              </label>
            </div>

            {/* Submit button (bottom of form) */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{
                background: canSubmit
                  ? 'linear-gradient(135deg, #2A97DF, #52C5FC)'
                  : 'rgba(255,255,255,0.06)',
                color: canSubmit ? '#fff' : '#7C8FA3',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Creating post…
                </span>
              ) : success ? (
                '✓ Post created!'
              ) : (
                'Create Post'
              )}
            </button>
          </div>

          <BottomNav activeTab="feed" />
        </div>
      </MobileFrame>
    </div>
  );
}
