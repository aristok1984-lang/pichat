-- ============================================================
-- Reddit-style Comments System
-- comments table + comment_likes table
-- RLS policies, indexes, triggers
-- ============================================================

-- 1. Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content       TEXT NOT NULL DEFAULT '',
  likes_count   INTEGER NOT NULL DEFAULT 0,
  depth         INTEGER NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: one like per user per comment
CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_likes_unique
  ON public.comment_likes (comment_id, user_id);

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id
  ON public.comments (post_id);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id
  ON public.comments (parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_author_id
  ON public.comments (author_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_parent
  ON public.comments (post_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_created_at
  ON public.comments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id
  ON public.comment_likes (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id
  ON public.comment_likes (user_id);

-- 4. Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for comments

-- Public read
DROP POLICY IF EXISTS "comments_public_read" ON public.comments;
CREATE POLICY "comments_public_read"
  ON public.comments FOR SELECT
  TO public
  USING (true);

-- Authenticated users can insert their own comments
DROP POLICY IF EXISTS "comments_authenticated_insert" ON public.comments;
CREATE POLICY "comments_authenticated_insert"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Authors can update their own comments
DROP POLICY IF EXISTS "comments_author_update" ON public.comments;
CREATE POLICY "comments_author_update"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Authors can delete their own comments
DROP POLICY IF EXISTS "comments_author_delete" ON public.comments;
CREATE POLICY "comments_author_delete"
  ON public.comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- 6. RLS Policies for comment_likes

-- Public read
DROP POLICY IF EXISTS "comment_likes_public_read" ON public.comment_likes;
CREATE POLICY "comment_likes_public_read"
  ON public.comment_likes FOR SELECT
  TO public
  USING (true);

-- Authenticated users can insert their own likes
DROP POLICY IF EXISTS "comment_likes_authenticated_insert" ON public.comment_likes;
CREATE POLICY "comment_likes_authenticated_insert"
  ON public.comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own likes
DROP POLICY IF EXISTS "comment_likes_user_delete" ON public.comment_likes;
CREATE POLICY "comment_likes_user_delete"
  ON public.comment_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 7. Function: update comment likes_count on like/unlike
CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.comment_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_comment_like_change ON public.comment_likes;
CREATE TRIGGER on_comment_like_change
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();

-- 8. Function: update post comments_count when a comment is inserted/deleted
CREATE OR REPLACE FUNCTION public.update_post_comments_count_from_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change_update_post ON public.comments;
CREATE TRIGGER on_comment_change_update_post
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count_from_comments();

-- 9. Function: auto-set depth on insert
CREATE OR REPLACE FUNCTION public.set_comment_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
  ELSE
    SELECT depth + 1 INTO NEW.depth
    FROM public.comments
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_set_depth ON public.comments;
CREATE TRIGGER on_comment_set_depth
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_comment_depth();

-- 10. Function: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_comment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_updated_at ON public.comments;
CREATE TRIGGER on_comment_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_comment_updated_at();

-- 11. Grant permissions
GRANT SELECT ON public.comments TO public;
GRANT INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comment_likes TO public;
GRANT INSERT, DELETE ON public.comment_likes TO authenticated;
