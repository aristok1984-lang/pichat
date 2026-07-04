-- PiChat Phase 1 MVP Migration
-- Tables: user_profiles, communities, community_members, posts, post_likes, post_bookmarks, follows

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.post_type CASCADE;
CREATE TYPE public.post_type AS ENUM ('text', 'image', 'video', 'repost');

DROP TYPE IF EXISTS public.community_role CASCADE;
CREATE TYPE public.community_role AS ENUM ('owner', 'moderator', 'member');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- User Profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Communities
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    owner_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    members_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    rules TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Community Members
CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role public.community_role DEFAULT 'member'::public.community_role,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    post_type public.post_type DEFAULT 'text'::public.post_type,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT DEFAULT '',
    video_url TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reposts_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    parent_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Post Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Post Bookmarks
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_community ON public.posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON public.post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ============================================================
-- 4. FUNCTIONS
-- ============================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    counter INTEGER := 0;
BEGIN
    base_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1)
    );
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
    IF length(base_username) < 3 THEN
        base_username := 'user' || base_username;
    END IF;
    final_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = final_username) LOOP
        counter := counter + 1;
        final_username := base_username || counter::TEXT;
    END LOOP;
    INSERT INTO public.user_profiles (id, email, username, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        final_username,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Update post likes count
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update follow counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.user_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE public.user_profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.user_profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
        UPDATE public.user_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update community member count
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.communities SET members_count = members_count + 1 WHERE id = NEW.community_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.communities SET members_count = GREATEST(0, members_count - 1) WHERE id = OLD.community_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update post count on user profile
CREATE OR REPLACE FUNCTION public.update_user_posts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.user_profiles SET posts_count = posts_count + 1 WHERE id = NEW.author_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.user_profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE id = OLD.author_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- user_profiles: public read, own write
DROP POLICY IF EXISTS "public_read_user_profiles" ON public.user_profiles;
CREATE POLICY "public_read_user_profiles" ON public.user_profiles
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles" ON public.user_profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- communities: public read, authenticated create, owner manage
DROP POLICY IF EXISTS "public_read_communities" ON public.communities;
CREATE POLICY "public_read_communities" ON public.communities
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_create_communities" ON public.communities;
CREATE POLICY "authenticated_create_communities" ON public.communities
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "owner_manage_communities" ON public.communities;
CREATE POLICY "owner_manage_communities" ON public.communities
FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- community_members: public read, own manage
DROP POLICY IF EXISTS "public_read_community_members" ON public.community_members;
CREATE POLICY "public_read_community_members" ON public.community_members
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_community_members" ON public.community_members;
CREATE POLICY "users_manage_own_community_members" ON public.community_members
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- posts: public read, own write
DROP POLICY IF EXISTS "public_read_posts" ON public.posts;
CREATE POLICY "public_read_posts" ON public.posts
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "authenticated_create_posts" ON public.posts;
CREATE POLICY "authenticated_create_posts" ON public.posts
FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_posts" ON public.posts;
CREATE POLICY "users_manage_own_posts" ON public.posts
FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- post_likes: public read, own manage
DROP POLICY IF EXISTS "public_read_post_likes" ON public.post_likes;
CREATE POLICY "public_read_post_likes" ON public.post_likes
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_post_likes" ON public.post_likes;
CREATE POLICY "users_manage_own_post_likes" ON public.post_likes
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- post_bookmarks: own manage only
DROP POLICY IF EXISTS "users_manage_own_post_bookmarks" ON public.post_bookmarks;
CREATE POLICY "users_manage_own_post_bookmarks" ON public.post_bookmarks
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- follows: public read, own manage
DROP POLICY IF EXISTS "public_read_follows" ON public.follows;
CREATE POLICY "public_read_follows" ON public.follows
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "users_manage_own_follows" ON public.follows;
CREATE POLICY "users_manage_own_follows" ON public.follows
FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
CREATE TRIGGER on_post_like_change
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

DROP TRIGGER IF EXISTS on_follow_change ON public.follows;
CREATE TRIGGER on_follow_change
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

DROP TRIGGER IF EXISTS on_community_member_change ON public.community_members;
CREATE TRIGGER on_community_member_change
    AFTER INSERT OR DELETE ON public.community_members
    FOR EACH ROW EXECUTE FUNCTION public.update_community_member_count();

DROP TRIGGER IF EXISTS on_post_change ON public.posts;
CREATE TRIGGER on_post_change
    AFTER INSERT OR DELETE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.update_user_posts_count();

-- ============================================================
-- 8. MOCK DATA
-- ============================================================
DO $$
DECLARE
    user1_uuid UUID := gen_random_uuid();
    user2_uuid UUID := gen_random_uuid();
    user3_uuid UUID := gen_random_uuid();
    comm1_uuid UUID := gen_random_uuid();
    comm2_uuid UUID := gen_random_uuid();
    comm3_uuid UUID := gen_random_uuid();
    post1_uuid UUID := gen_random_uuid();
    post2_uuid UUID := gen_random_uuid();
    post3_uuid UUID := gen_random_uuid();
    post4_uuid UUID := gen_random_uuid();
    post5_uuid UUID := gen_random_uuid();
BEGIN
    -- Auth users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, phone, phone_change,
        phone_change_token, phone_change_sent_at
    ) VALUES
        (user1_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'alex.morgan@pichat.app', crypt('PiChat#2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('display_name', 'Alex Morgan', 'username', 'alex_morgan'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (user2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'sofia.reyes@pichat.app', crypt('PiChat#2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('display_name', 'Sofia Reyes', 'username', 'sofia_reyes'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
        (user3_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'kai.nakamura@pichat.app', crypt('PiChat#2026', gen_salt('bf', 10)), now(), now(), now(),
         jsonb_build_object('display_name', 'Kai Nakamura', 'username', 'kai_nakamura'),
         jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

    -- Update profiles with richer data (trigger creates base rows)
    UPDATE public.user_profiles SET
        bio = 'Building the future of social. Coffee addict. Open source contributor.',
        is_verified = true,
        followers_count = 1240,
        following_count = 312
    WHERE id = user1_uuid;

    UPDATE public.user_profiles SET
        bio = 'Creator & designer. Sharing my journey through art and tech.',
        is_verified = true,
        followers_count = 8920,
        following_count = 445
    WHERE id = user2_uuid;

    UPDATE public.user_profiles SET
        bio = 'Developer by day, gamer by night. Building cool stuff.',
        followers_count = 567,
        following_count = 890
    WHERE id = user3_uuid;

    -- Communities
    INSERT INTO public.communities (id, name, slug, description, owner_id, members_count, tags, rules)
    VALUES
        (comm1_uuid, 'TechTalk', 'techtalk',
         'The hub for developers, engineers, and tech enthusiasts. Share projects, ask questions, and stay up to date.',
         user1_uuid, 4821,
         ARRAY['technology', 'programming', 'dev', 'opensource']::TEXT[],
         'Be respectful. No spam. Share knowledge freely.'),
        (comm2_uuid, 'DesignCraft', 'designcraft',
         'A community for designers, artists, and creatives. Share your work, get feedback, and find inspiration.',
         user2_uuid, 2340,
         ARRAY['design', 'art', 'ux', 'creative']::TEXT[],
         'Constructive feedback only. Credit original artists.'),
        (comm3_uuid, 'GamersUnite', 'gamersunite',
         'For gamers of all kinds. Discuss games, share clips, find teammates, and talk strategy.',
         user3_uuid, 9102,
         ARRAY['gaming', 'esports', 'games', 'community']::TEXT[],
         'No toxicity. All platforms welcome. Have fun.')
    ON CONFLICT (id) DO NOTHING;

    -- Community memberships
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES
        (comm1_uuid, user1_uuid, 'owner'::public.community_role),
        (comm1_uuid, user2_uuid, 'member'::public.community_role),
        (comm1_uuid, user3_uuid, 'member'::public.community_role),
        (comm2_uuid, user2_uuid, 'owner'::public.community_role),
        (comm2_uuid, user1_uuid, 'member'::public.community_role),
        (comm3_uuid, user3_uuid, 'owner'::public.community_role),
        (comm3_uuid, user1_uuid, 'member'::public.community_role),
        (comm3_uuid, user2_uuid, 'member'::public.community_role)
    ON CONFLICT (community_id, user_id) DO NOTHING;

    -- Posts
    INSERT INTO public.posts (id, author_id, community_id, post_type, content, tags, likes_count, comments_count, reposts_count)
    VALUES
        (post1_uuid, user1_uuid, comm1_uuid, 'text'::public.post_type,
         'Just shipped a new open-source library for real-time state sync. Built it with zero dependencies and it handles 10k concurrent connections. Check it out and let me know what you think!',
         ARRAY['opensource', 'javascript', 'realtime']::TEXT[], 284, 47, 62),
        (post2_uuid, user2_uuid, comm2_uuid, 'text'::public.post_type,
         'Redesigned our entire design system from scratch. The key insight: consistency beats creativity every time when you are building at scale. Here is what I learned after 6 months of iteration.',
         ARRAY['design', 'ux', 'designsystem']::TEXT[], 521, 89, 134),
        (post3_uuid, user3_uuid, comm3_uuid, 'text'::public.post_type,
         'Hot take: the best gaming moments are not the wins — they are the near-misses that make your heart race. What is your most memorable gaming moment?',
         ARRAY['gaming', 'community']::TEXT[], 1203, 312, 89),
        (post4_uuid, user1_uuid, NULL, 'text'::public.post_type,
         'The future of social platforms is community-first. People do not want another feed — they want belonging. That is what we are building with PiChat.',
         ARRAY['pichat', 'community', 'social']::TEXT[], 892, 156, 203),
        (post5_uuid, user2_uuid, comm1_uuid, 'text'::public.post_type,
         'UI tip: dark mode is not just about inverting colors. It is about rethinking contrast, depth, and hierarchy for a completely different lighting environment. Here are 5 principles I follow.',
         ARRAY['ui', 'darkmode', 'design', 'tips']::TEXT[], 445, 78, 91)
    ON CONFLICT (id) DO NOTHING;

    -- Follows
    INSERT INTO public.follows (follower_id, following_id)
    VALUES
        (user1_uuid, user2_uuid),
        (user1_uuid, user3_uuid),
        (user2_uuid, user1_uuid),
        (user3_uuid, user1_uuid),
        (user3_uuid, user2_uuid)
    ON CONFLICT (follower_id, following_id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data error: %', SQLERRM;
END $$;
