-- Bootstrap auth schema, helper function & roles required by GoTrue + PostgREST + Firebase Backup Mirror
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

GRANT anon, authenticated, service_role TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Supabase-compatible auth.uid() helper for PostgREST v12 (supports both legacy & JSON claims)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Mirrored User Directory linking Primary Firebase Auth UIDs with Backup Supabase Auth
CREATE TABLE IF NOT EXISTS public.synced_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE,
  supabase_user_id UUID UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  primary_provider TEXT NOT NULL DEFAULT 'firebase',
  last_sign_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.synced_users ENABLE ROW LEVEL SECURITY;

-- Strict Zero-Trust RLS:
-- Public/anon cannot read or enumerate users.
-- Authenticated users may read ONLY their own row; server service_role handles mirror upserts.
DROP POLICY IF EXISTS "Users can read own synced profile" ON public.synced_users;
CREATE POLICY "Users can read own synced profile"
  ON public.synced_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = supabase_user_id);

REVOKE ALL ON public.synced_users FROM anon;
GRANT SELECT ON public.synced_users TO authenticated;
GRANT ALL ON public.synced_users TO service_role;
