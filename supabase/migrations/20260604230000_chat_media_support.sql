-- PiChat Phase 3: Chat Media Support
-- Adds audio MIME type to chat-media bucket and ensures media columns exist

-- ============================================================
-- 1. Update chat-media bucket to allow audio files
-- ============================================================
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm'
]
WHERE id = 'chat-media';

-- ============================================================
-- 2. Ensure media columns exist on direct_messages
-- ============================================================
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT '';

-- ============================================================
-- 3. Ensure media columns exist on group_messages
-- ============================================================
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT '';

-- ============================================================
-- 4. Storage RLS policies for chat-media bucket
-- ============================================================
DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
