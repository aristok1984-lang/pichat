-- PiChat: Notification Triggers + Community Compose Post
-- Adds DB-level triggers to auto-insert notifications on likes, follows, replies, mentions
-- Also adds community_members role column for future moderation

-- ============================================================
-- 1. NOTIFICATION TRIGGER FUNCTION: on post like
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_author UUID;
BEGIN
  -- Get the post author
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = NEW.post_id LIMIT 1;

  -- Don't notify if liking own post
  IF v_post_author IS NOT NULL AND v_post_author <> NEW.user_id THEN
    INSERT INTO public.notifications (
      recipient_id, actor_id, notification_type, entity_id, entity_type, message
    ) VALUES (
      v_post_author,
      NEW.user_id,
      'like'::public.notification_type,
      NEW.post_id,
      'post',
      'liked your post'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_like ON public.post_likes;
CREATE TRIGGER trg_notify_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_like();

-- ============================================================
-- 2. NOTIFICATION TRIGGER FUNCTION: on follow
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Don't notify if following yourself
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications (
      recipient_id, actor_id, notification_type, entity_id, entity_type, message
    ) VALUES (
      NEW.following_id,
      NEW.follower_id,
      'follow'::public.notification_type,
      NEW.follower_id,
      'user',
      'started following you'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ============================================================
-- 3. NOTIFICATION TRIGGER FUNCTION: on reply / mention
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_post_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_author UUID;
BEGIN
  -- Only fire for replies (posts with a parent_post_id)
  IF NEW.parent_post_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author FROM public.posts WHERE id = NEW.parent_post_id LIMIT 1;

    IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.author_id THEN
      INSERT INTO public.notifications (
        recipient_id, actor_id, notification_type, entity_id, entity_type, message
      ) VALUES (
        v_parent_author,
        NEW.author_id,
        'reply'::public.notification_type,
        NEW.id,
        'post',
        'replied to your post'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_reply ON public.posts;
CREATE TRIGGER trg_notify_post_reply
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_reply();

-- ============================================================
-- 4. NOTIFICATION TRIGGER FUNCTION: on community post (notify owner)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_community_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_community_owner UUID;
BEGIN
  IF NEW.community_id IS NOT NULL THEN
    SELECT owner_id INTO v_community_owner FROM public.communities WHERE id = NEW.community_id LIMIT 1;

    IF v_community_owner IS NOT NULL AND v_community_owner <> NEW.author_id THEN
      INSERT INTO public.notifications (
        recipient_id, actor_id, notification_type, entity_id, entity_type, message
      ) VALUES (
        v_community_owner,
        NEW.author_id,
        'community_post'::public.notification_type,
        NEW.community_id,
        'community',
        'posted in your community'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_post ON public.posts;
CREATE TRIGGER trg_notify_community_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post();

-- ============================================================
-- 5. NOTIFICATION TRIGGER FUNCTION: on reel like
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_reel_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reel_author UUID;
BEGIN
  SELECT author_id INTO v_reel_author FROM public.reels WHERE id = NEW.reel_id LIMIT 1;

  IF v_reel_author IS NOT NULL AND v_reel_author <> NEW.user_id THEN
    INSERT INTO public.notifications (
      recipient_id, actor_id, notification_type, entity_id, entity_type, message
    ) VALUES (
      v_reel_author,
      NEW.user_id,
      'reel_like'::public.notification_type,
      NEW.reel_id,
      'reel',
      'liked your reel'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reel_like ON public.reel_likes;
CREATE TRIGGER trg_notify_reel_like
  AFTER INSERT ON public.reel_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reel_like();

-- ============================================================
-- 6. AUTO-UPDATE communities.members_count on join/leave
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_community_members_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
    SET members_count = members_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
    SET members_count = GREATEST(0, members_count - 1)
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_members_count ON public.community_members;
CREATE TRIGGER trg_community_members_count
  AFTER INSERT OR DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.update_community_members_count();

-- ============================================================
-- 7. AUTO-UPDATE communities.posts_count on post insert/delete
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
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_posts_count ON public.posts;
CREATE TRIGGER trg_community_posts_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_community_posts_count();

-- ============================================================
-- 8. ADD role column to community_members if not exists
-- ============================================================
ALTER TABLE public.community_members
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- ============================================================
-- 9. INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON public.post_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_following ON public.follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_created ON public.posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_community_user ON public.community_members(community_id, user_id);
