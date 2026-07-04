-- User Profiles Extended Migration
-- Adds: full_name, occupation, location, birthplace, studied_at, went_to, x_account, phone, field_privacy
-- Updates: handle_new_user trigger to include new fields

-- ============================================================
-- 1. ADD MISSING COLUMNS TO user_profiles
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS occupation TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS birthplace TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS studied_at TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS went_to TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS x_account TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS field_privacy JSONB DEFAULT '{}'::jsonb;

-- ============================================================
-- 2. UPDATE handle_new_user TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    username,
    display_name,
    full_name,
    avatar_url,
    bio,
    occupation,
    location,
    birthplace,
    studied_at,
    went_to,
    x_account,
    phone,
    field_privacy,
    is_verified,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '{}'::jsonb,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. BACKFILL existing profiles that have null full_name
-- ============================================================

UPDATE public.user_profiles
SET
  full_name = COALESCE(full_name, display_name, ''),
  field_privacy = COALESCE(field_privacy, '{}'::jsonb)
WHERE full_name IS NULL OR field_privacy IS NULL;
