-- PiChat: Posting System — ensure RLS and community posts_count trigger
-- This migration is idempotent (safe to run multiple times)

-- ============================================================
-- 1. Ensure authenticated users can INSERT posts
-- ============================================================
DROP POLICY IF EXISTS "authenticated_create_posts" ON public.posts;
CREATE POLICY "authenticated_create_posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

-- ============================================================
-- 2. Ensure authenticated users can manage their own posts
-- ============================================================
DROP POLICY IF EXISTS "users_manage_own_posts" ON public.posts;
CREATE POLICY "users_manage_own_posts"
ON public.posts
FOR ALL
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- ============================================================
-- 3. Ensure posts are publicly readable
-- ============================================================
DROP POLICY IF EXISTS "public_read_posts" ON public.posts;
CREATE POLICY "public_read_posts"
ON public.posts
FOR SELECT
TO public
USING (true);

-- ============================================================
-- 4. Community posts_count trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_community_posts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.community_id IS NOT NULL THEN
        UPDATE public.communities
        SET posts_count = posts_count + 1
        WHERE id = NEW.community_id;
    ELSIF TG_OP = 'DELETE' AND OLD.community_id IS NOT NULL THEN
        UPDATE public.communities
        SET posts_count = GREATEST(0, posts_count - 1)
        WHERE id = OLD.community_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_post_community_count ON public.posts;
CREATE TRIGGER on_post_community_count
    AFTER INSERT OR DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.update_community_posts_count();
