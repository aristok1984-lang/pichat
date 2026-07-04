-- Add expiry columns to messages table for 7-hour lifetime feature
-- These columns are required for messages to be saved and fetched correctly

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS delete_after_ms BIGINT DEFAULT 25200000; -- 7 hours in ms

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill expires_at for existing messages that don't have it
UPDATE public.messages
SET expires_at = created_at + INTERVAL '7 hours'
WHERE expires_at IS NULL;

-- Index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at)
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);
