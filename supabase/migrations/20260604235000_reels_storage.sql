-- Reels storage bucket setup
-- Creates the reels-videos bucket for user-uploaded reel videos

-- Create storage bucket for reel videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reels-videos',
  'reels-videos',
  true,
  104857600,  -- 100MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reels-videos bucket
DO $$
BEGIN
  -- Public read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reels_videos_public_read' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "reels_videos_public_read" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'reels-videos');
  END IF;

  -- Authenticated users can upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reels_videos_auth_insert' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "reels_videos_auth_insert" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reels-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Users can delete their own uploads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'reels_videos_auth_delete' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "reels_videos_auth_delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'reels-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
