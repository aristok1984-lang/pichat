-- ============================================================
-- Add increment_comments_count RPC + auto-trigger for comments
-- ============================================================

-- RPC callable from client
CREATE OR REPLACE FUNCTION public.increment_comments_count(post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.posts
  SET comments_count = comments_count + 1
  WHERE id = post_id AND parent_post_id IS NULL;
END;
$$;

-- Trigger function to auto-update comments_count when a reply is inserted/deleted
CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_post_id IS NOT NULL THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.parent_post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_post_id IS NOT NULL THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.parent_post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to posts table (for reply inserts/deletes)
DROP TRIGGER IF EXISTS on_post_comment_change ON public.posts;
CREATE TRIGGER on_post_comment_change
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- Grant execute on the RPC to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_comments_count(UUID) TO authenticated;
