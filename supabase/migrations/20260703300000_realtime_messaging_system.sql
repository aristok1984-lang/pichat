-- ============================================================
-- PiChat Real-Time Messaging System Migration
-- Timestamp: 20260703300000
-- ============================================================

-- ── 1. Add missing columns to existing messages table ────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_for JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- ── 2. message_reactions table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- ── 3. message_reads table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- ── 4. typing_indicators table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON public.messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON public.message_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON public.message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON public.message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one ON public.conversations(participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two ON public.conversations(participant_two);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation_id ON public.typing_indicators(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);

-- ── 6. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- ── 7. Helper function: is_conversation_participant ──────────────────────────
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conv_id
      AND (participant_one = auth.uid() OR participant_two = auth.uid())
  );
$$;

-- ── 8. RLS Policies: conversations ───────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_participants_select" ON public.conversations;
CREATE POLICY "conv_participants_select" ON public.conversations
  FOR SELECT TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "conv_participants_insert" ON public.conversations;
CREATE POLICY "conv_participants_insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "conv_participants_update" ON public.conversations;
CREATE POLICY "conv_participants_update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid())
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

-- ── 9. RLS Policies: messages ─────────────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_participants_select" ON public.messages;
CREATE POLICY "msg_participants_select" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "msg_sender_insert" ON public.messages;
CREATE POLICY "msg_sender_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "msg_sender_update" ON public.messages;
CREATE POLICY "msg_sender_update" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "msg_sender_delete" ON public.messages;
CREATE POLICY "msg_sender_delete" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ── 10. RLS Policies: message_reactions ──────────────────────────────────────
DROP POLICY IF EXISTS "reactions_participants_select" ON public.message_reactions;
CREATE POLICY "reactions_participants_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "reactions_user_insert" ON public.message_reactions;
CREATE POLICY "reactions_user_insert" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_user_delete" ON public.message_reactions;
CREATE POLICY "reactions_user_delete" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 11. RLS Policies: message_reads ──────────────────────────────────────────
DROP POLICY IF EXISTS "reads_participants_select" ON public.message_reads;
CREATE POLICY "reads_participants_select" ON public.message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "reads_user_insert" ON public.message_reads;
CREATE POLICY "reads_user_insert" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reads_user_upsert" ON public.message_reads;
CREATE POLICY "reads_user_upsert" ON public.message_reads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 12. RLS Policies: typing_indicators ──────────────────────────────────────
DROP POLICY IF EXISTS "typing_participants_select" ON public.typing_indicators;
CREATE POLICY "typing_participants_select" ON public.typing_indicators
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "typing_user_all" ON public.typing_indicators;
CREATE POLICY "typing_user_all" ON public.typing_indicators
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 13. RLS Policies: user_presence ──────────────────────────────────────────
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_public_select" ON public.user_presence;
CREATE POLICY "presence_public_select" ON public.user_presence
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "presence_user_all" ON public.user_presence;
CREATE POLICY "presence_user_all" ON public.user_presence
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 14. Trigger: update conversation on new message ──────────────────────────
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_other_participant UUID;
  v_is_participant_one BOOLEAN;
BEGIN
  SELECT participant_one, participant_two,
         (participant_one = NEW.sender_id)
  INTO v_other_participant, v_other_participant, v_is_participant_one
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Get the other participant
  SELECT CASE WHEN participant_one = NEW.sender_id THEN participant_two ELSE participant_one END
  INTO v_other_participant
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Update conversation last message and unread counts
  IF v_is_participant_one THEN
    UPDATE public.conversations
    SET last_message_text = CASE WHEN NEW.message_type = 'image' THEN '📷 Photo' ELSE LEFT(NEW.content, 100) END,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        unread_count_two = unread_count_two + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.conversations
    SET last_message_text = CASE WHEN NEW.message_type = 'image' THEN '📷 Photo' ELSE LEFT(NEW.content, 100) END,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        unread_count_one = unread_count_one + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert ON public.messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- ── 15. Trigger: reset unread count when messages are read ───────────────────
CREATE OR REPLACE FUNCTION public.reset_unread_on_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset unread count for the reader
  UPDATE public.conversations
  SET unread_count_one = CASE WHEN participant_one = NEW.user_id THEN 0 ELSE unread_count_one END,
      unread_count_two = CASE WHEN participant_two = NEW.user_id THEN 0 ELSE unread_count_two END
  WHERE id = (
    SELECT conversation_id FROM public.messages WHERE id = NEW.message_id LIMIT 1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_read ON public.message_reads;
CREATE TRIGGER on_message_read
  AFTER INSERT ON public.message_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_unread_on_read();

-- ── 16. Function: get_or_create_conversation ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id UUID;
  v_current_user UUID := auth.uid();
BEGIN
  -- Try to find existing conversation
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE (participant_one = v_current_user AND participant_two = other_user_id)
     OR (participant_one = other_user_id AND participant_two = v_current_user)
  LIMIT 1;

  -- Create if not found
  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_one, participant_two)
    VALUES (v_current_user, other_user_id)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- ── 17. Cleanup stale typing indicators (older than 10 seconds) ──────────────
CREATE OR REPLACE FUNCTION public.cleanup_stale_typing()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.typing_indicators
  WHERE updated_at < now() - INTERVAL '10 seconds';
END;
$$;
