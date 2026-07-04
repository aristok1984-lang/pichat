-- PiChat Phase 2 Migration
-- Tables: direct_messages, group_chats, group_members, group_messages, reels, reel_likes, notifications

-- ============================================================
-- 0. CLEAN SLATE (drop Phase 2 tables if they exist from a failed run)
-- ============================================================
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.reel_likes CASCADE;
DROP TABLE IF EXISTS public.reels CASCADE;
DROP TABLE IF EXISTS public.group_messages CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.group_chats CASCADE;
DROP TABLE IF EXISTS public.direct_messages CASCADE;

-- ============================================================
-- 1. TYPES
-- ============================================================
DROP TYPE IF EXISTS public.message_type CASCADE;
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'audio', 'file', 'sticker');

DROP TYPE IF EXISTS public.notification_type CASCADE;
CREATE TYPE public.notification_type AS ENUM ('like', 'reply', 'follow', 'mention', 'community_post', 'group_invite', 'reel_like');

-- ============================================================
-- 2. DIRECT MESSAGES
-- ============================================================
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    message_type public.message_type DEFAULT 'text'::public.message_type,
    media_url TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT false,
    is_deleted_by_sender BOOLEAN DEFAULT false,
    is_deleted_by_receiver BOOLEAN DEFAULT false,
    reply_to_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. GROUP CHATS
-- ============================================================
CREATE TABLE public.group_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    members_count INTEGER DEFAULT 0,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE TABLE public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    message_type public.message_type DEFAULT 'text'::public.message_type,
    media_url TEXT DEFAULT '',
    reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. REELS
-- ============================================================
CREATE TABLE public.reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    audio_name TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.reel_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reel_id, user_id)
);

-- ============================================================
-- 5. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    notification_type public.notification_type NOT NULL,
    entity_id UUID,
    entity_type TEXT DEFAULT '',
    message TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. INDEXES
-- ============================================================
CREATE INDEX idx_dm_sender ON public.direct_messages(sender_id);
CREATE INDEX idx_dm_receiver ON public.direct_messages(receiver_id);
CREATE INDEX idx_dm_created ON public.direct_messages(created_at DESC);
CREATE INDEX idx_group_messages_group ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_created ON public.group_messages(created_at DESC);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_reels_author ON public.reels(author_id);
CREATE INDEX idx_reels_created ON public.reels(created_at DESC);
CREATE INDEX idx_reel_likes_reel ON public.reel_likes(reel_id);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id, is_read);

-- ============================================================
-- 7. ENABLE RLS
-- ============================================================
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================

-- direct_messages: only sender and receiver can see
CREATE POLICY "dm_participants_select" ON public.direct_messages
FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "dm_sender_insert" ON public.direct_messages
FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "dm_sender_update" ON public.direct_messages
FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- group_chats: members can see
CREATE POLICY "group_chats_member_select" ON public.group_chats
FOR SELECT TO authenticated USING (
    is_public = true OR
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_chats.id AND gm.user_id = auth.uid())
);

CREATE POLICY "group_chats_create" ON public.group_chats
FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "group_chats_admin_update" ON public.group_chats
FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- group_members: members can see their own groups
CREATE POLICY "group_members_select" ON public.group_members
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "group_members_insert" ON public.group_members
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "group_members_delete" ON public.group_members
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- group_messages: group members can see and send
CREATE POLICY "group_messages_select" ON public.group_messages
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
);

CREATE POLICY "group_messages_insert" ON public.group_messages
FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid())
);

-- reels: public read, own write
CREATE POLICY "public_read_reels" ON public.reels
FOR SELECT TO public USING (is_active = true);

CREATE POLICY "authenticated_create_reels" ON public.reels
FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

CREATE POLICY "users_manage_own_reels" ON public.reels
FOR ALL TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- reel_likes: public read, own manage
CREATE POLICY "public_read_reel_likes" ON public.reel_likes
FOR SELECT TO public USING (true);

CREATE POLICY "users_manage_own_reel_likes" ON public.reel_likes
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notifications: own only
CREATE POLICY "notifications_own_select" ON public.notifications
FOR SELECT TO authenticated USING (recipient_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications_own_update" ON public.notifications
FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- ============================================================
-- 9. FUNCTIONS
-- ============================================================

-- Update reel likes count
CREATE OR REPLACE FUNCTION public.update_reel_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.reels SET likes_count = likes_count + 1 WHERE id = NEW.reel_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.reels SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.reel_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update group member count
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.group_chats SET members_count = members_count + 1 WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.group_chats SET members_count = GREATEST(0, members_count - 1) WHERE id = OLD.group_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update group last message
CREATE OR REPLACE FUNCTION public.update_group_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.group_chats
    SET last_message = NEW.content, last_message_at = NEW.created_at
    WHERE id = NEW.group_id;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 10. TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_reel_like_change ON public.reel_likes;
CREATE TRIGGER on_reel_like_change
    AFTER INSERT OR DELETE ON public.reel_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_reel_likes_count();

DROP TRIGGER IF EXISTS on_group_member_change ON public.group_members;
CREATE TRIGGER on_group_member_change
    AFTER INSERT OR DELETE ON public.group_members
    FOR EACH ROW EXECUTE FUNCTION public.update_group_member_count();

DROP TRIGGER IF EXISTS on_group_message_insert ON public.group_messages;
CREATE TRIGGER on_group_message_insert
    AFTER INSERT ON public.group_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_group_last_message();

-- ============================================================
-- 11. MOCK DATA
-- ============================================================
DO $$
DECLARE
    user1_uuid UUID;
    user2_uuid UUID;
    user3_uuid UUID;
    group1_uuid UUID := gen_random_uuid();
    group2_uuid UUID := gen_random_uuid();
    reel1_uuid UUID := gen_random_uuid();
    reel2_uuid UUID := gen_random_uuid();
    reel3_uuid UUID := gen_random_uuid();
    reel4_uuid UUID := gen_random_uuid();
BEGIN
    -- Get existing user IDs
    SELECT id INTO user1_uuid FROM public.user_profiles WHERE username = 'alex_morgan' LIMIT 1;
    SELECT id INTO user2_uuid FROM public.user_profiles WHERE username = 'sofia_reyes' LIMIT 1;
    SELECT id INTO user3_uuid FROM public.user_profiles WHERE username = 'kai_nakamura' LIMIT 1;

    IF user1_uuid IS NULL OR user2_uuid IS NULL OR user3_uuid IS NULL THEN
        RAISE NOTICE 'Skipping mock data: demo users not found';
        RETURN;
    END IF;

    -- Direct messages between user1 and user2
    INSERT INTO public.direct_messages (sender_id, receiver_id, content, is_read, created_at)
    VALUES
        (user2_uuid, user1_uuid, 'Hey! Loved your latest post about real-time sync 🔥', true, NOW() - INTERVAL '2 hours'),
        (user1_uuid, user2_uuid, 'Thanks Sofia! It took a while to get right but super happy with it', true, NOW() - INTERVAL '1 hour 50 minutes'),
        (user2_uuid, user1_uuid, 'Would love to collaborate on something. Are you free this week?', true, NOW() - INTERVAL '1 hour 30 minutes'),
        (user1_uuid, user2_uuid, 'Absolutely! Let''s set up a call. How about Thursday?', false, NOW() - INTERVAL '1 hour');

    -- Direct messages between user1 and user3
    INSERT INTO public.direct_messages (sender_id, receiver_id, content, is_read, created_at)
    VALUES
        (user3_uuid, user1_uuid, 'Yo! Did you see the new game drop? It''s insane', true, NOW() - INTERVAL '3 hours'),
        (user1_uuid, user3_uuid, 'Not yet! Which one?', true, NOW() - INTERVAL '2 hours 45 minutes'),
        (user3_uuid, user1_uuid, 'The new open world RPG. Graphics are next level', false, NOW() - INTERVAL '2 hours 30 minutes');

    -- Group chats
    INSERT INTO public.group_chats (id, name, description, created_by, members_count, last_message, last_message_at)
    VALUES
        (group1_uuid, 'PiChat Dev Team', 'Building the future together 🚀', user1_uuid, 3, 'Let''s ship Phase 2!', NOW() - INTERVAL '30 minutes'),
        (group2_uuid, 'Design Collab', 'Creative minds unite ✨', user2_uuid, 2, 'Check out this new mockup', NOW() - INTERVAL '1 hour');

    -- Group members
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES
        (group1_uuid, user1_uuid, 'admin'),
        (group1_uuid, user2_uuid, 'member'),
        (group1_uuid, user3_uuid, 'member'),
        (group2_uuid, user2_uuid, 'admin'),
        (group2_uuid, user1_uuid, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    -- Group messages
    INSERT INTO public.group_messages (group_id, sender_id, content, created_at)
    VALUES
        (group1_uuid, user1_uuid, 'Phase 1 is live! Time to start Phase 2 🎉', NOW() - INTERVAL '2 hours'),
        (group1_uuid, user2_uuid, 'Amazing work everyone! The UI looks stunning', NOW() - INTERVAL '1 hour 45 minutes'),
        (group1_uuid, user3_uuid, 'Reels feature is going to be 🔥', NOW() - INTERVAL '1 hour 30 minutes'),
        (group1_uuid, user1_uuid, 'Let''s ship Phase 2!', NOW() - INTERVAL '30 minutes'),
        (group2_uuid, user2_uuid, 'Working on the new design system', NOW() - INTERVAL '2 hours'),
        (group2_uuid, user1_uuid, 'Check out this new mockup', NOW() - INTERVAL '1 hour');

    -- Reels
    INSERT INTO public.reels (id, author_id, video_url, thumbnail_url, caption, audio_name, tags, likes_count, comments_count, views_count, duration_seconds)
    VALUES
        (reel1_uuid, user2_uuid,
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=700&fit=crop',
         'New design system drop 🎨 Swipe to see all the components! #design #ux #darkmode',
         'Aesthetic Vibes - Lo-fi Mix',
         ARRAY['design', 'ux', 'ui', 'darkmode']::TEXT[],
         2847, 312, 48200, 28),
        (reel2_uuid, user3_uuid,
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
         'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=700&fit=crop',
         'This game mechanic is INSANE 🎮 Never seen anything like it #gaming #gamers',
         'Epic Gaming Beat - Producer X',
         ARRAY['gaming', 'games', 'esports']::TEXT[],
         5621, 891, 124000, 35),
        (reel3_uuid, user1_uuid,
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
         'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=700&fit=crop',
         'Built this real-time feature in 2 hours ⚡ Here''s how #coding #dev #javascript',
         'Code Flow - Synthwave',
         ARRAY['coding', 'dev', 'javascript', 'tech']::TEXT[],
         3102, 445, 67800, 42),
        (reel4_uuid, user2_uuid,
         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
         'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400&h=700&fit=crop',
         'Color theory in 60 seconds 🎨 Save this for later! #design #colors #tips',
         'Chill Beats - Study Mix',
         ARRAY['design', 'colors', 'tips', 'creative']::TEXT[],
         1893, 234, 39100, 58);

    -- Notifications
    INSERT INTO public.notifications (recipient_id, actor_id, notification_type, entity_id, entity_type, message)
    VALUES
        (user1_uuid, user2_uuid, 'follow', user2_uuid, 'user', 'Sofia Reyes started following you'),
        (user1_uuid, user3_uuid, 'like', reel3_uuid, 'reel', 'Kai Nakamura liked your reel'),
        (user1_uuid, user2_uuid, 'mention', reel1_uuid, 'reel', 'Sofia Reyes mentioned you in a reel'),
        (user2_uuid, user1_uuid, 'follow', user1_uuid, 'user', 'Alex Morgan started following you'),
        (user2_uuid, user3_uuid, 'like', reel1_uuid, 'reel', 'Kai Nakamura liked your reel'),
        (user3_uuid, user1_uuid, 'like', reel2_uuid, 'reel', 'Alex Morgan liked your reel');

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Phase 2 mock data error: %', SQLERRM;
END $$;
