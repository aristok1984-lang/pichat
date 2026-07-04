-- PiChat: Fix infinite recursion in communities RLS policies
-- Root cause: communities SELECT policy queries community_members,
--             community_members ALL policy queries communities → circular loop
-- Fix: Use SECURITY DEFINER functions to break the recursion chain

-- ============================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
--    These run with elevated privileges and bypass RLS,
--    breaking the recursive policy evaluation loop.
-- ============================================================

-- Check if the current user is a member of a community (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_community_member(community_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = community_uuid
      AND user_id = auth.uid()
  );
$$;

-- Check if the current user is an owner or admin of a community (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_community_owner_or_admin(community_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = community_uuid
      AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = community_uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'moderator')
  );
$$;

-- Check if the current user owns a community (bypasses RLS, direct column check)
CREATE OR REPLACE FUNCTION public.is_community_owner(community_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = community_uuid
      AND owner_id = auth.uid()
  );
$$;

-- ============================================================
-- 2. DROP ALL EXISTING communities RLS POLICIES
--    Remove every policy that could cause recursion
-- ============================================================

DROP POLICY IF EXISTS "public_read_communities" ON public.communities;
DROP POLICY IF EXISTS "members_read_private_communities" ON public.communities;
DROP POLICY IF EXISTS "authenticated_create_communities" ON public.communities;
DROP POLICY IF EXISTS "owner_update_communities" ON public.communities;
DROP POLICY IF EXISTS "owner_delete_communities" ON public.communities;

-- Also drop any policies from earlier migrations that may still be active
DROP POLICY IF EXISTS "communities_select_policy" ON public.communities;
DROP POLICY IF EXISTS "communities_insert_policy" ON public.communities;
DROP POLICY IF EXISTS "communities_update_policy" ON public.communities;
DROP POLICY IF EXISTS "communities_delete_policy" ON public.communities;

-- ============================================================
-- 3. DROP ALL EXISTING community_members RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "public_read_community_members" ON public.community_members;
DROP POLICY IF EXISTS "authenticated_join_community" ON public.community_members;
DROP POLICY IF EXISTS "authenticated_leave_community" ON public.community_members;
DROP POLICY IF EXISTS "owner_manage_community_members" ON public.community_members;

-- Also drop any policies from earlier migrations
DROP POLICY IF EXISTS "community_members_select_policy" ON public.community_members;
DROP POLICY IF EXISTS "community_members_insert_policy" ON public.community_members;
DROP POLICY IF EXISTS "community_members_update_policy" ON public.community_members;
DROP POLICY IF EXISTS "community_members_delete_policy" ON public.community_members;

-- ============================================================
-- 4. RECREATE communities RLS POLICIES (no recursion)
-- ============================================================

-- SELECT: Public communities are readable by everyone.
--         Private communities are readable by owner or members.
--         Uses SECURITY DEFINER function to avoid recursion.
DROP POLICY IF EXISTS "communities_select" ON public.communities;
CREATE POLICY "communities_select"
ON public.communities
FOR SELECT
TO public
USING (
  is_private = false
  OR owner_id = auth.uid()
  OR public.is_community_member(id)
);

-- INSERT: Authenticated users can create communities they own
DROP POLICY IF EXISTS "communities_insert" ON public.communities;
CREATE POLICY "communities_insert"
ON public.communities
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- UPDATE: Only the owner can update (simple direct check, no subquery)
--         Moderator/admin update uses the SECURITY DEFINER function
DROP POLICY IF EXISTS "communities_update" ON public.communities;
CREATE POLICY "communities_update"
ON public.communities
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_community_owner_or_admin(id)
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_community_owner_or_admin(id)
);

-- DELETE: Only the owner can delete (direct column check, no subquery)
DROP POLICY IF EXISTS "communities_delete" ON public.communities;
CREATE POLICY "communities_delete"
ON public.communities
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ============================================================
-- 5. RECREATE community_members RLS POLICIES (no recursion)
-- ============================================================

-- SELECT: Anyone can read community members
DROP POLICY IF EXISTS "community_members_select" ON public.community_members;
CREATE POLICY "community_members_select"
ON public.community_members
FOR SELECT
TO public
USING (true);

-- INSERT: Authenticated users can join communities (insert own membership)
DROP POLICY IF EXISTS "community_members_insert" ON public.community_members;
CREATE POLICY "community_members_insert"
ON public.community_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Community owner can update member roles
--         Uses SECURITY DEFINER function to check ownership without recursion
DROP POLICY IF EXISTS "community_members_update" ON public.community_members;
CREATE POLICY "community_members_update"
ON public.community_members
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_owner(community_id)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_community_owner(community_id)
);

-- DELETE: Users can leave (delete own membership); owners can remove members
DROP POLICY IF EXISTS "community_members_delete" ON public.community_members;
CREATE POLICY "community_members_delete"
ON public.community_members
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_community_owner(community_id)
);

-- ============================================================
-- 6. ENSURE RLS IS ENABLED
-- ============================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
