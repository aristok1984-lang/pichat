-- PiChat: Community Profiles Enhancement
-- Adds category column, ensures RLS policies are correct for community CRUD

-- ============================================================
-- 1. ADD MISSING COLUMNS TO communities
-- ============================================================
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''::text;

-- ============================================================
-- 2. ENSURE RLS IS ENABLED
-- ============================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. RLS POLICIES FOR communities
-- ============================================================

-- Public can read public communities
DROP POLICY IF EXISTS "public_read_communities" ON public.communities;
CREATE POLICY "public_read_communities"
ON public.communities
FOR SELECT
TO public
USING (is_private = false);

-- Authenticated users can read all communities they are a member of (including private)
DROP POLICY IF EXISTS "members_read_private_communities" ON public.communities;
CREATE POLICY "members_read_private_communities"
ON public.communities
FOR SELECT
TO authenticated
USING (
  is_private = false
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = id AND cm.user_id = auth.uid()
  )
);

-- Authenticated users can create communities
DROP POLICY IF EXISTS "authenticated_create_communities" ON public.communities;
CREATE POLICY "authenticated_create_communities"
ON public.communities
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Only owner/admin can update community
DROP POLICY IF EXISTS "owner_update_communities" ON public.communities;
CREATE POLICY "owner_update_communities"
ON public.communities
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.community_members cm
    WHERE cm.community_id = id AND cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin')
  )
);

-- Only owner can delete community
DROP POLICY IF EXISTS "owner_delete_communities" ON public.communities;
CREATE POLICY "owner_delete_communities"
ON public.communities
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ============================================================
-- 4. RLS POLICIES FOR community_members
-- ============================================================

-- Anyone can read community members
DROP POLICY IF EXISTS "public_read_community_members" ON public.community_members;
CREATE POLICY "public_read_community_members"
ON public.community_members
FOR SELECT
TO public
USING (true);

-- Authenticated users can join communities (insert own membership)
DROP POLICY IF EXISTS "authenticated_join_community" ON public.community_members;
CREATE POLICY "authenticated_join_community"
ON public.community_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can leave communities (delete own membership)
DROP POLICY IF EXISTS "authenticated_leave_community" ON public.community_members;
CREATE POLICY "authenticated_leave_community"
ON public.community_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Owner/admin can manage members
DROP POLICY IF EXISTS "owner_manage_community_members" ON public.community_members;
CREATE POLICY "owner_manage_community_members"
ON public.community_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id AND c.owner_id = auth.uid()
  )
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_owner_id ON public.communities(owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_category ON public.communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_is_private ON public.communities(is_private);
