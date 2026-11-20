/*
# Store accounts table + photo storage

1. New Tables
- `store_accounts`: game accounts shown publicly.
  - `id` (uuid, primary key)
  - `game_id` (text, not null) — the in-game account ID
  - `server_id` (text, not null) — the in-game server ID
  - `contact_number` (text, not null) — contact phone number shown as WhatsApp link
  - `price` (integer, not null) — price in EGP
  - `page` (text, not null) — 'customers' or 'store', which public page the account appears on
  - `sold` (boolean, default false) — sold badge state
  - `photos` (text array, not null default '{}') — ordered public URLs of uploaded photos
  - `created_at` (timestamptz, default now())

2. Storage
- New public storage bucket `account-photos` for uploaded account photos (anyone can view; only authenticated owner can write/delete).

3. Security
- Enable RLS on `store_accounts`.
- Public (anon + authenticated) can SELECT rows: visitors browse the accounts pages.
- Only `authenticated` (the owner, signed in) can INSERT, UPDATE, DELETE: visitors can never add or edit accounts.
- GRANTs match policies: SELECT for anon+authenticated; INSERT/UPDATE/DELETE for authenticated only.
- Storage policies: public read on the bucket; insert/update/delete for authenticated only.
*/

CREATE TABLE IF NOT EXISTS store_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  server_id text NOT NULL,
  contact_number text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  page text NOT NULL CHECK (page IN ('customers', 'store')),
  sold boolean NOT NULL DEFAULT false,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON store_accounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON store_accounts TO authenticated;

DROP POLICY IF EXISTS "public_read_accounts" ON store_accounts;
CREATE POLICY "public_read_accounts" ON store_accounts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_accounts" ON store_accounts;
CREATE POLICY "owner_insert_accounts" ON store_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "owner_update_accounts" ON store_accounts;
CREATE POLICY "owner_update_accounts" ON store_accounts
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "owner_delete_accounts" ON store_accounts;
CREATE POLICY "owner_delete_accounts" ON store_accounts
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO storage.buckets (id, name, public)
VALUES ('account-photos', 'account-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_account_photos" ON storage.objects;
CREATE POLICY "public_read_account_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'account-photos');

DROP POLICY IF EXISTS "owner_insert_account_photos" ON storage.objects;
CREATE POLICY "owner_insert_account_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'account-photos');

DROP POLICY IF EXISTS "owner_update_account_photos" ON storage.objects;
CREATE POLICY "owner_update_account_photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'account-photos') WITH CHECK (bucket_id = 'account-photos');

DROP POLICY IF EXISTS "owner_delete_account_photos" ON storage.objects;
CREATE POLICY "owner_delete_account_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'account-photos');
