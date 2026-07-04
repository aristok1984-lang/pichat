-- Demo Bot User Migration
-- Creates a demo user profile that is always shown as online
-- and can receive/send messages for testing purposes.

DO $$
DECLARE
  demo_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Insert demo user profile (no auth.users entry needed — bot is not a real auth user)
  INSERT INTO public.user_profiles (
    id,
    email,
    username,
    display_name,
    bio,
    avatar_url,
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    demo_user_id,
    'demo@pichat.internal',
    'pichat_demo',
    'PiChat Demo',
    'I am a demo bot. Send me a message and I will reply!',
    '',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    bio = EXCLUDED.bio,
    is_verified = EXCLUDED.is_verified,
    updated_at = now();

  -- Also ensure username uniqueness conflict is handled
  -- (in case a different id already has this username)
  UPDATE public.user_profiles
  SET username = 'pichat_demo'
  WHERE id = demo_user_id;

  -- Set demo user as always online
  INSERT INTO public.user_presence (
    user_id,
    is_online,
    last_seen,
    updated_at
  ) VALUES (
    demo_user_id,
    true,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_online = true,
    last_seen = now(),
    updated_at = now();

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Demo bot setup error: %', SQLERRM;
END $$;

-- Function: send a reply from the demo bot
-- Called by the API route /api/demo-bot/reply
CREATE OR REPLACE FUNCTION public.demo_bot_reply(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  demo_user_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  new_msg_id UUID;
  p1 UUID;
  p2 UUID;
BEGIN
  -- Only allow the demo bot to send messages
  IF p_sender_id != demo_user_id THEN
    RAISE EXCEPTION 'Unauthorized: only demo bot can use this function';
  END IF;

  -- Insert the reply message
  INSERT INTO public.direct_messages (
    sender_id,
    receiver_id,
    content,
    message_type,
    is_read,
    created_at,
    updated_at
  ) VALUES (
    p_sender_id,
    p_receiver_id,
    p_content,
    'text',
    false,
    now(),
    now()
  )
  RETURNING id INTO new_msg_id;

  -- Update or create conversation
  SELECT LEAST(p_sender_id, p_receiver_id), GREATEST(p_sender_id, p_receiver_id)
  INTO p1, p2;

  INSERT INTO public.conversations (
    participant_one,
    participant_two,
    last_message_text,
    last_message_at,
    last_message_sender_id,
    created_at,
    updated_at
  ) VALUES (
    p1, p2, p_content, now(), p_sender_id, now(), now()
  )
  ON CONFLICT (participant_one, participant_two) DO UPDATE SET
    last_message_text = EXCLUDED.last_message_text,
    last_message_at = EXCLUDED.last_message_at,
    last_message_sender_id = EXCLUDED.last_message_sender_id,
    updated_at = now();

  RETURN new_msg_id;
END;
$$;
