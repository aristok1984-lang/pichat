-- Migration: Block enforcement — RLS policies to hide blocked users' content

-- ============================================================
-- 1. HELPER FUNCTION: Check if current user is blocked by or has blocked a given user
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_blocked_by_or_has_blocked(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = other_user_id)
       OR (blocker_id = other_user_id AND blocked_id = auth.uid())
  );
$$;

-- ============================================================
-- 2. RLS POLICIES ON POSTS — hide posts from blocked/blocking users
-- ============================================================
DROP POLICY IF EXISTS "posts_hide_blocked" ON public.posts;
CREATE POLICY "posts_hide_blocked"
ON public.posts
FOR SELECT
TO authenticated
USING (
  NOT public.is_blocked_by_or_has_blocked(author_id)
);

-- Allow unauthenticated reads (public feed) — no block filter needed
DROP POLICY IF EXISTS "posts_public_read" ON public.posts;
CREATE POLICY "posts_public_read"
ON public.posts
FOR SELECT
TO anon
USING (true);

-- ============================================================
-- 3. RLS POLICIES ON REELS — hide reels from blocked/blocking users
-- ============================================================
DROP POLICY IF EXISTS "reels_hide_blocked" ON public.reels;
CREATE POLICY "reels_hide_blocked"
ON public.reels
FOR SELECT
TO authenticated
USING (
  NOT public.is_blocked_by_or_has_blocked(author_id)
);

DROP POLICY IF EXISTS "reels_public_read" ON public.reels;
CREATE POLICY "reels_public_read"
ON public.reels
FOR SELECT
TO anon
USING (true);

-- ============================================================
-- 4. INDEX to speed up block lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_blocked ON public.user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_blocker ON public.user_blocks(blocked_id, blocker_id);
