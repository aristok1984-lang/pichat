-- Add reactions JSONB column to group_messages
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;
