-- Stories RLS policies
-- Drop existing policies if any to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "stories_select_policy" ON public.stories;
  DROP POLICY IF EXISTS "stories_insert_policy" ON public.stories;
  DROP POLICY IF EXISTS "stories_delete_policy" ON public.stories;
  DROP POLICY IF EXISTS "story_views_select_policy" ON public.story_views;
  DROP POLICY IF EXISTS "story_views_insert_policy" ON public.story_views;
END $$;

-- Stories: anyone authenticated can read non-expired stories
CREATE POLICY "stories_select_policy" ON public.stories
  FOR SELECT USING (expires_at > now());

-- Stories: authenticated users can insert their own stories
CREATE POLICY "stories_insert_policy" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stories: users can delete their own stories
CREATE POLICY "stories_delete_policy" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Story views: authenticated users can read views on their own stories
CREATE POLICY "story_views_select_policy" ON public.story_views
  FOR SELECT USING (
    auth.uid() = viewer_id OR
    auth.uid() IN (
      SELECT user_id FROM public.stories WHERE id = story_id
    )
  );

-- Story views: authenticated users can insert their own views
CREATE POLICY "story_views_insert_policy" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);
