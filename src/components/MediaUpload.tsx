'use client';

import React, { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';

export type MediaType = 'image' | 'video' | 'audio';

export interface UploadedMedia {
  url: string;
  type: MediaType;
  name: string;
}

interface MediaUploadProps {
  onMediaSelected: (media: UploadedMedia | null) => void;
  selectedMedia: UploadedMedia | null;
  userId: string;
}

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm';
const MAX_SIZE_MB = 50;

function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'audio';
}

export default function MediaUpload({ onMediaSelected, selectedMedia, userId }: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) fileInputRef.current = null as any;
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setError('');
    setUploading(true);

    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      const mediaType = getMediaType(file.type);
      onMediaSelected({ url: data.publicUrl, type: mediaType, name: file.name });
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleFileChange}
        className="hidden"
        id="media-upload-input"
      />

      {/* Attach button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 shrink-0 relative"
        title="Attach media"
      >
        {uploading ? (
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
        {selectedMedia && (
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-primary border border-background" />
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded text-xs text-white bg-red-500 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Media Preview (shown above input bar when media is selected) ─────────────
interface MediaPreviewProps {
  media: UploadedMedia;
  onRemove: () => void;
}

export function MediaPreview({ media, onRemove }: MediaPreviewProps) {
  return (
    <div className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl mb-2 max-w-[200px]"
      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
      {media.type === 'image' && (
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
          <AppImage src={media.url} alt={media.name} width={48} height={48} className="w-full h-full object-cover" />
        </div>
      )}
      {media.type === 'video' && (
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'var(--secondary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
          </svg>
        </div>
      )}
      {media.type === 'audio' && (
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'var(--secondary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate">{media.name}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{media.type}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
        style={{ background: 'var(--primary)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Media Message Bubble Content ─────────────────────────────────────────────
interface MediaBubbleProps {
  mediaUrl: string;
  mediaType: string;
  content?: string;
}

export function MediaBubble({ mediaUrl, mediaType, content }: MediaBubbleProps) {
  if (!mediaUrl) return content ? <p className="text-sm leading-relaxed">{content}</p> : null;

  return (
    <div className="flex flex-col gap-1">
      {mediaType === 'image' && (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block">
          <div className="rounded-xl overflow-hidden max-w-[200px]">
            <AppImage
              src={mediaUrl}
              alt="Shared image"
              width={200}
              height={150}
              className="w-full h-auto object-cover"
            />
          </div>
        </a>
      )}
      {mediaType === 'video' && (
        <div className="rounded-xl overflow-hidden max-w-[200px]">
          <video
            src={mediaUrl}
            controls
            className="w-full rounded-xl"
            style={{ maxHeight: '150px' }}
          />
        </div>
      )}
      {mediaType === 'audio' && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.15)', minWidth: '160px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-80">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <audio src={mediaUrl} controls className="flex-1 h-7" style={{ minWidth: 0 }} />
        </div>
      )}
      {content && <p className="text-sm leading-relaxed">{content}</p>}
    </div>
  );
}
