-- Group Chat Triggers: auto-update last_message on group_chats, fix member visibility

-- Fix group_members_select so all members of a group can see each other
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm2
    WHERE gm2.group_id = group_members.group_id
    AND gm2.user_id = auth.uid()
  )
);

-- Allow group admins/creators to insert members (invite others)
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    WHERE gc.id = group_id AND gc.created_by = auth.uid()
  )
);

-- Trigger: update group_chats.last_message and last_message_at on new group message
CREATE OR REPLACE FUNCTION public.update_group_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.group_chats
  SET
    last_message = NEW.content,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_group_last_message ON public.group_messages;
CREATE TRIGGER trg_update_group_last_message
AFTER INSERT ON public.group_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_group_last_message();

-- Trigger: update group_chats.members_count on insert/delete of group_members
CREATE OR REPLACE FUNCTION public.update_group_members_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_chats SET members_count = members_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.group_chats SET members_count = GREATEST(members_count - 1, 0) WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_group_members_count ON public.group_members;
CREATE TRIGGER trg_update_group_members_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.update_group_members_count();
