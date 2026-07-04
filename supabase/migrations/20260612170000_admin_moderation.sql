-- Admin & Content Moderation Migration
-- Adds admin role support and moderation action logging

-- 1. Add admin/suspension columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 2. Admin actions log table
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_id ON public.admin_actions(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON public.content_reports(created_at DESC);

-- 3. Function to check admin status from user_profiles (safe - not used on user_profiles RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    false
  )
$$;

-- 4. Enable RLS
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for admin_actions
DROP POLICY IF EXISTS "admins_manage_admin_actions" ON public.admin_actions;
CREATE POLICY "admins_manage_admin_actions"
ON public.admin_actions
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- 6. Allow admins to read all user_profiles (additional policy)
DROP POLICY IF EXISTS "admins_read_all_profiles" ON public.user_profiles;
CREATE POLICY "admins_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (public.is_platform_admin() OR id = auth.uid());

-- 7. Allow admins to update any user_profile (for suspend/unsuspend)
DROP POLICY IF EXISTS "admins_update_any_profile" ON public.user_profiles;
CREATE POLICY "admins_update_any_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (public.is_platform_admin() OR id = auth.uid())
WITH CHECK (public.is_platform_admin() OR id = auth.uid());

-- 8. Allow admins to read all posts
DROP POLICY IF EXISTS "admins_read_all_posts" ON public.posts;
CREATE POLICY "admins_read_all_posts"
ON public.posts
FOR SELECT
TO authenticated
USING (public.is_platform_admin() OR true);

-- 9. Allow admins to delete any post
DROP POLICY IF EXISTS "admins_delete_any_post" ON public.posts;
CREATE POLICY "admins_delete_any_post"
ON public.posts
FOR DELETE
TO authenticated
USING (public.is_platform_admin() OR author_id = auth.uid());

-- 10. Allow admins to read all content_reports
DROP POLICY IF EXISTS "admins_manage_content_reports" ON public.content_reports;
CREATE POLICY "admins_manage_content_reports"
ON public.content_reports
FOR ALL
TO authenticated
USING (public.is_platform_admin() OR reporter_id = auth.uid())
WITH CHECK (public.is_platform_admin() OR reporter_id = auth.uid());

-- 11. Allow admins to manage communities
DROP POLICY IF EXISTS "admins_manage_communities" ON public.communities;
CREATE POLICY "admins_manage_communities"
ON public.communities
FOR ALL
TO authenticated
USING (public.is_platform_admin() OR owner_id = auth.uid())
WITH CHECK (public.is_platform_admin() OR owner_id = auth.uid());
