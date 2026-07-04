-- Migration: Add reactions to direct_messages + RLS for blocks/reports

-- ============================================================
-- 1. ADD REACTIONS COLUMN TO DIRECT_MESSAGES
-- ============================================================
ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. RLS POLICIES FOR USER_BLOCKS (if not already set)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_select'
  ) THEN
    EXECUTE 'CREATE POLICY user_blocks_select ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_insert'
  ) THEN
    EXECUTE 'CREATE POLICY user_blocks_insert ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'user_blocks_delete'
  ) THEN
    EXECUTE 'CREATE POLICY user_blocks_delete ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id)';
  END IF;
END $$;

-- ============================================================
-- 3. RLS POLICIES FOR CONTENT_REPORTS (if not already set)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_reports' AND policyname = 'content_reports_select'
  ) THEN
    EXECUTE 'CREATE POLICY content_reports_select ON public.content_reports FOR SELECT USING (auth.uid() = reporter_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_reports' AND policyname = 'content_reports_insert'
  ) THEN
    EXECUTE 'CREATE POLICY content_reports_insert ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id)';
  END IF;
END $$;

-- ============================================================
-- 4. INDEX FOR REACTIONS QUERIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_direct_messages_reactions ON public.direct_messages USING gin(reactions);
