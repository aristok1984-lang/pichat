-- PiChat Phase 3 Migration
-- Features: pinned_posts table for community pinning, channel sub-channels support
-- Note: community_channels, channel_messages, posts.is_pinned already exist

-- ============================================================
-- 1. PINNED POSTS TABLE (for community-level pinning)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pinned_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    pinned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pinned_posts_context_check CHECK (
        (community_id IS NOT NULL AND profile_id IS NULL) OR
        (profile_id IS NOT NULL AND community_id IS NULL)
    )
);

-- ============================================================
-- 2. ADD PARENT_CHANNEL_ID TO COMMUNITY_CHANNELS (sub-channels)
-- ============================================================
ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS parent_channel_id UUID REFERENCES public.community_channels(id) ON DELETE CASCADE;

ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0;

ALTER TABLE public.community_channels
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pinned_posts_community ON public.pinned_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_pinned_posts_profile ON public.pinned_posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_pinned_posts_post ON public.pinned_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_community_channels_parent ON public.community_channels(parent_channel_id);
CREATE INDEX IF NOT EXISTS idx_community_channels_community ON public.community_channels(community_id);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.pinned_posts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- pinned_posts: public read
DROP POLICY IF EXISTS "public_read_pinned_posts" ON public.pinned_posts;
CREATE POLICY "public_read_pinned_posts" ON public.pinned_posts
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_manage_pinned_posts" ON public.pinned_posts;
CREATE POLICY "authenticated_manage_pinned_posts" ON public.pinned_posts
FOR ALL TO authenticated USING (pinned_by = auth.uid()) WITH CHECK (pinned_by = auth.uid());
