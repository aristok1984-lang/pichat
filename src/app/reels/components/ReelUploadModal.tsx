'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ReelUploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function ReelUploadModal({ onClose, onUploaded }: ReelUploadModalProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [audioName, setAudioName] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, MOV, etc.)');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('Video must be under 100MB');
      return;
    }
    setError('');
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setStep('details');
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  async function handleUpload() {
    if (!videoFile || !user) return;
    setUploading(true);
    setError('');
    setUploadProgress(10);

    try {
      // Upload video to Supabase storage
      const ext = videoFile.name.split('.').pop() || 'mp4';
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      setUploadProgress(30);

      const { data: storageData, error: storageError } = await supabase.storage
        .from('reels-videos')
        .upload(fileName, videoFile, { cacheControl: '3600', upsert: false });

      if (storageError) throw storageError;

      setUploadProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('reels-videos')
        .getPublicUrl(storageData.path);

      const videoUrl = urlData.publicUrl;

      // Parse tags
      const parsedTags = tags
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      setUploadProgress(85);

      // Insert reel record
      const { error: insertError } = await supabase.from('reels').insert({
        author_id: user.id,
        video_url: videoUrl,
        thumbnail_url: '',
        caption: caption.trim(),
        audio_name: audioName.trim() || 'Original Audio',
        tags: parsedTags,
        is_active: true,
      });

      if (insertError) throw insertError;

      setUploadProgress(100);
      setTimeout(() => {
        onUploaded();
        onClose();
      }, 400);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleBack() {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl('');
    setStep('pick');
    setError('');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--card)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          {step === 'details' ? (
            <button onClick={handleBack} className="p-1 rounded-full" style={{ color: 'var(--foreground)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : (
            <div className="w-7" />
          )}
          <h2 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>New Reel</h2>
          <button onClick={onClose} className="p-1 rounded-full" style={{ color: 'var(--muted-foreground)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'pick' ? (
            /* ── Step 1: Pick video ── */
            <div className="p-4 flex flex-col gap-4">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-12"
                style={{
                  borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
                  background: isDragging ? 'rgba(var(--primary-rgb, 42,171,238), 0.05)' : 'var(--muted)',
                }}
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--primary)', opacity: 0.9 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Tap to select a video</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>MP4, WebM, MOV · Max 100MB</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleInputChange}
              />

              {error && (
                <p className="text-xs text-center px-2" style={{ color: '#EF4444' }}>{error}</p>
              )}

              <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
                Vertical videos (9:16) look best in the Reels feed
              </p>
            </div>
          ) : (
            /* ── Step 2: Details ── */
            <div className="p-4 flex flex-col gap-4">
              {/* Video preview */}
              <div className="relative rounded-xl overflow-hidden mx-auto" style={{ width: 120, height: 213, background: '#000' }}>
                <video
                  ref={videoPreviewRef}
                  src={videoPreviewUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
                  <span className="text-white text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    Preview
                  </span>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Caption</label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  maxLength={300}
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none border"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                  }}
                />
                <p className="text-right text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{caption.length}/300</p>
              </div>

              {/* Audio name */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Audio name</label>
                <input
                  type="text"
                  value={audioName}
                  onChange={e => setAudioName(e.target.value)}
                  placeholder="Original Audio"
                  maxLength={80}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                  }}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>Tags</label>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="dance, funny, travel (comma separated)"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                  }}
                />
              </div>

              {error && (
                <p className="text-xs px-1" style={{ color: '#EF4444' }}>{error}</p>
              )}

              {/* Upload progress */}
              {uploading && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Uploading…</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%`, background: 'var(--primary)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Post button (only on details step) */}
        {step === 'details' && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity"
              style={{
                background: 'var(--primary)',
                color: '#fff',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? 'Posting…' : 'Post Reel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
