/*
# Single-owner admin lockdown (admins table + admin-gated RLS everywhere)

1. New table
- `admins`: user_id (uuid, primary key, references auth.users ON DELETE CASCADE), created_at.
  The owner is inserted by looking up the email gamerstore200730@gmail.com in auth.users.
  If that user does not exist yet, nothing is inserted (we never create auth users from SQL).

2. New function
- `is_admin()` (security definer, fixed search_path, STABLE): returns true only when
  auth.uid() exists in `admins`. Every owner-facing policy now calls this, so the real
  protection lives in the database, not in the UI.

3. Security changes (RLS)
- All former "owner_*" policies that only checked "is logged in" are REPLACED by
  "admin_*" policies that require is_admin() on:
    packages, other_packages, accounts (read/insert/update/delete),
    orders (read/update/delete), account_requests (read/update/delete).
- Visitor policies unchanged: anon can read active packages, active other_packages,
  published accounts; insert orders only via create_order RPC; read exactly one order
  by uuid via get_my_order RPC; insert account_requests only.
- Dropped stray policy "public_read_accounts" (USING true) which leaked unpublished
  accounts; "public_read_published_accounts" (published = true) remains the only
  public read path.
- Storage `objects` policies for account-photos: insert/update/delete now require
  is_admin() for authenticated users. Visitor upload stays limited to the requests/
  folder; public read of photos stays (the site displays them).
- `admins` itself: RLS on, SELECT granted to authenticated, users can read only their
  own row. is_admin() EXECUTE revoked from PUBLIC/anon, granted to authenticated.
- Grants tightened to least privilege: anon lost INSERT/UPDATE/DELETE on packages,
  other_packages, accounts, lost everything on orders (RPCs are SECURITY DEFINER and
  do not need anon grants on the table), and lost SELECT/UPDATE/DELETE on
  account_requests (insert-only for visitors).

4. Notes
- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT DO NOTHING.
- No transaction control statements.
*/

-- ---------- 1. admins ----------
CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admins FROM anon;
GRANT SELECT ON public.admins TO authenticated;

DROP POLICY IF EXISTS "admins_read_own_row" ON public.admins;
CREATE POLICY "admins_read_own_row" ON public.admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE email = 'gamerstore200730@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ---------- 2. is_admin() ----------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- 3. packages ----------
DROP POLICY IF EXISTS "owner_read_all_packages" ON packages;
DROP POLICY IF EXISTS "owner_write_packages" ON packages;
DROP POLICY IF EXISTS "owner_update_packages" ON packages;
DROP POLICY IF EXISTS "owner_delete_packages" ON packages;

CREATE POLICY "admin_read_all_packages" ON packages
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_packages" ON packages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_packages" ON packages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_packages" ON packages
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- other_packages ----------
DROP POLICY IF EXISTS "owner_read_all_other_packages" ON other_packages;
DROP POLICY IF EXISTS "owner_insert_other_packages" ON other_packages;
DROP POLICY IF EXISTS "owner_update_other_packages" ON other_packages;
DROP POLICY IF EXISTS "owner_delete_other_packages" ON other_packages;

CREATE POLICY "admin_read_all_other_packages" ON other_packages
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_other_packages" ON other_packages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_other_packages" ON other_packages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_other_packages" ON other_packages
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- accounts ----------
DROP POLICY IF EXISTS "owner_read_all_accounts" ON accounts;
DROP POLICY IF EXISTS "owner_insert_accounts" ON accounts;
DROP POLICY IF EXISTS "owner_update_accounts" ON accounts;
DROP POLICY IF EXISTS "owner_delete_accounts" ON accounts;
DROP POLICY IF EXISTS "public_read_accounts" ON accounts;

CREATE POLICY "admin_read_all_accounts" ON accounts
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_insert_accounts" ON accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admin_update_accounts" ON accounts
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_accounts" ON accounts
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- orders ----------
DROP POLICY IF EXISTS "owner_select_orders" ON orders;
DROP POLICY IF EXISTS "owner_update_orders" ON orders;
DROP POLICY IF EXISTS "owner_delete_orders" ON orders;

CREATE POLICY "admin_read_orders" ON orders
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_orders" ON orders
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- account_requests ----------
DROP POLICY IF EXISTS "owner_read_account_requests" ON account_requests;
DROP POLICY IF EXISTS "owner_update_account_requests" ON account_requests;
DROP POLICY IF EXISTS "owner_delete_account_requests" ON account_requests;

CREATE POLICY "admin_read_account_requests" ON account_requests
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admin_update_account_requests" ON account_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_account_requests" ON account_requests
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- storage: account-photos management requires admin ----------
DROP POLICY IF EXISTS "owner_insert_account_photos" ON storage.objects;
DROP POLICY IF EXISTS "owner_update_account_photos" ON storage.objects;
DROP POLICY IF EXISTS "owner_delete_account_photos" ON storage.objects;

CREATE POLICY "admin_insert_account_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'account-photos' AND public.is_admin());
CREATE POLICY "admin_update_account_photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'account-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'account-photos' AND public.is_admin());
CREATE POLICY "admin_delete_account_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'account-photos' AND public.is_admin());

-- ---------- grants: least privilege ----------
REVOKE INSERT, UPDATE, DELETE ON packages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON other_packages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON accounts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON orders FROM anon;
REVOKE SELECT, UPDATE, DELETE ON account_requests FROM anon;