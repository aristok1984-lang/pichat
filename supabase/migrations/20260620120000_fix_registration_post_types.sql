-- PiChat: Fix registration + add post type columns for Reddit-style posts
-- 1. Fix handle_new_user trigger to be robust
-- 2. Add post_type enum values for link/poll
-- 3. Add title, link_url, poll_options columns to posts
-- 4. Fix RLS on user_profiles for insert during signup

-- ============================================================
-- 1. FIX handle_new_user trigger (robust version)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INTEGER := 0;
BEGIN
    -- Derive base username from metadata or email
    base_username := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
        split_part(NEW.email, '@', 1)
    );
    -- Strip non-alphanumeric/underscore characters
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
    -- Ensure minimum length
    IF length(base_username) < 3 THEN
        base_username := 'user' || base_username;
    END IF;
    -- Ensure uniqueness
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;

    INSERT INTO public.user_profiles (id, email, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        final_username,
        COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            final_username
        ),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = CASE
            WHEN public.user_profiles.display_name = '' OR public.user_profiles.display_name IS NULL
            THEN EXCLUDED.display_name
            ELSE public.user_profiles.display_name
        END;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log but don't fail auth
        RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Re-create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Fix RLS on user_profiles — allow service role insert
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_all_profiles" ON public.user_profiles;
CREATE POLICY "users_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================
-- 3. Ensure post_type enum exists with all required values
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.post_type AS ENUM ('text', 'image', 'video', 'repost', 'link', 'poll');
    END IF;
END $$;

-- Add link and poll values if the type already exists (must be outside transaction block)
ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'link';
ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'poll';

-- ============================================================
-- 4. Ensure posts table has post_type column
-- ============================================================
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS post_type public.post_type DEFAULT 'text'::public.post_type;

-- ============================================================
-- 5. Add Reddit-style columns to posts table
-- ============================================================
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT '';

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS poll_options JSONB DEFAULT NULL;

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS poll_votes JSONB DEFAULT NULL;

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN DEFAULT false;

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT true;

-- ============================================================
-- 6. Indexes for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts(post_type);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'posts'
          AND column_name = 'parent_post_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posts_parent_post ON public.posts(parent_post_id) WHERE parent_post_id IS NOT NULL';
    END IF;
END $$;
