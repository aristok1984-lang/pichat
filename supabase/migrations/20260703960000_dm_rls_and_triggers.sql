-- ─────────────────────────────────────────────────────────────────────────────
-- DM: Add receiver_id to messages, fix RLS, add conversation update trigger
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add receiver_id column to messages (if not exists)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 2. Add deleted_for_sender / deleted_for_receiver / deleted_for_everyone columns
--    (deleted_for jsonb already exists; we keep it and add explicit booleans for clarity)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN NOT NULL DEFAULT false;

-- 3. Add last_message_preview alias column to conversations (maps to last_message_text)
--    last_message_text already exists — no new column needed.

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one ON public.conversations(participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two ON public.conversations(participant_two);

-- 5. Helper function: is_conversation_participant
--    Returns true if auth.uid() is participant_one or participant_two
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

-- 6. Helper function: get_or_create_conversation
--    Finds existing DM conversation between two users or creates one.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id UUID;
  me UUID := auth.uid();
BEGIN
  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM public.conversations
  WHERE (participant_one = me AND participant_two = other_user_id)
     OR (participant_one = other_user_id AND participant_two = me)
  LIMIT 1;

  -- Create if not found
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_one, participant_two)
    VALUES (me, other_user_id)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$;

-- 7. Trigger function: update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_participant_one UUID;
  conv_participant_two UUID;
BEGIN
  -- Get participants
  SELECT participant_one, participant_two
  INTO conv_participant_one, conv_participant_two
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Update last message info and increment unread for the receiver
  IF NEW.sender_id = conv_participant_one THEN
    UPDATE public.conversations
    SET
      last_message_text = LEFT(NEW.content, 100),
      last_message_at = NEW.created_at,
      last_message_sender_id = NEW.sender_id,
      unread_count_two = unread_count_two + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.conversations
    SET
      last_message_text = LEFT(NEW.content, 100),
      last_message_at = NEW.created_at,
      last_message_sender_id = NEW.sender_id,
      unread_count_one = unread_count_one + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_insert_update_conversation ON public.messages;
CREATE TRIGGER on_message_insert_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- 8. Trigger function: reset unread count when user reads conversation
CREATE OR REPLACE FUNCTION public.reset_unread_on_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_participant_one UUID;
  conv_participant_two UUID;
BEGIN
  -- Only process when read_at is being set (was null, now has value)
  IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    SELECT participant_one, participant_two
    INTO conv_participant_one, conv_participant_two
    FROM public.conversations
    WHERE id = NEW.conversation_id;

    -- Reset unread count for the receiver (the one who just read)
    IF NEW.receiver_id = conv_participant_one THEN
      UPDATE public.conversations
      SET unread_count_one = GREATEST(0, unread_count_one - 1)
      WHERE id = NEW.conversation_id;
    ELSIF NEW.receiver_id = conv_participant_two THEN
      UPDATE public.conversations
      SET unread_count_two = GREATEST(0, unread_count_two - 1)
      WHERE id = NEW.conversation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_read_reset_unread ON public.messages;
CREATE TRIGGER on_message_read_reset_unread
  AFTER UPDATE OF read_at ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_unread_on_read();

-- 9. Enable RLS (idempotent)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for conversations
DROP POLICY IF EXISTS "conv_select_participants" ON public.conversations;
CREATE POLICY "conv_select_participants"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "conv_insert_authenticated" ON public.conversations;
CREATE POLICY "conv_insert_authenticated"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "conv_update_participants" ON public.conversations;
CREATE POLICY "conv_update_participants"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid())
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

-- 11. RLS Policies for messages
DROP POLICY IF EXISTS "msg_select_conversation_participant" ON public.messages;
CREATE POLICY "msg_select_conversation_participant"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "msg_insert_as_sender" ON public.messages;
CREATE POLICY "msg_insert_as_sender"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "msg_update_own" ON public.messages;
CREATE POLICY "msg_update_own"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS "msg_delete_own" ON public.messages;
CREATE POLICY "msg_delete_own"
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));
