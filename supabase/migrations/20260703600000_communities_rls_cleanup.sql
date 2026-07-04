-- PiChat: Communities RLS cleanup — remove legacy phase1 policies
-- The previous fix migration (20260703500000) dropped all policies from
-- 20260703000000_community_profiles.sql but missed two legacy policies
-- that were created in 20260604002000_pichat_phase1.sql:
--   • "owner_manage_communities"          (FOR ALL on communities)
--   • "users_manage_own_community_members" (FOR ALL on community_members)
--
-- These do not cause recursion but can conflict with the new specific
-- policies created in the fix migration. Drop them to ensure a clean,
-- unambiguous policy set.

-- ============================================================
-- 1. DROP REMAINING LEGACY POLICIES
-- ============================================================

-- Legacy phase1 FOR ALL policy on communities (superseded by specific policies)
DROP POLICY IF EXISTS "owner_manage_communities" ON public.communities;

-- Legacy phase1 FOR ALL policy on community_members (superseded by specific policies)
DROP POLICY IF EXISTS "users_manage_own_community_members" ON public.community_members;

-- ============================================================
-- 2. VERIFY SECURITY DEFINER FUNCTIONS EXIST
--    Re-create them idempotently to ensure they are present
--    even if the previous migration was partially applied.
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
-- 3. ENSURE FINAL POLICY SET IS CORRECT
--    Re-apply all communities + community_members policies
--    idempotently so the state is deterministic regardless of
--    which prior migrations were applied.
-- ============================================================

-- ── communities ──────────────────────────────────────────────

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

DROP POLICY IF EXISTS "communities_insert" ON public.communities;
CREATE POLICY "communities_insert"
ON public.communities
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

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

DROP POLICY IF EXISTS "communities_delete" ON public.communities;
CREATE POLICY "communities_delete"
ON public.communities
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ── community_members ─────────────────────────────────────────

DROP POLICY IF EXISTS "community_members_select" ON public.community_members;
CREATE POLICY "community_members_select"
ON public.community_members
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "community_members_insert" ON public.community_members;
CREATE POLICY "community_members_insert"
ON public.community_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

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
-- 4. ENSURE RLS IS ENABLED
-- ============================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
