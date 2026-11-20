-- ============================================================
-- GAMER STORE — COMPLETE SCHEMA (run once in Supabase SQL Editor)
-- Idempotent: safe to run again. Does not delete existing data.
-- ============================================================

-- ---------- 1. TABLES ----------

CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL CHECK (game IN ('ml', 'starlight')),
  tab text NOT NULL,
  sub_section text,
  label text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.other_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  note text,
  end_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL CHECK (game IN ('ml', 'starlight')),
  package_label text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  player_id text NOT NULL,
  server_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photos text[] NOT NULL DEFAULT '{}',
  game_id text NOT NULL,
  server_id text NOT NULL,
  contact_number text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  page text NOT NULL DEFAULT 'customers' CHECK (page IN ('customers', 'store')),
  sold boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photos text[] NOT NULL DEFAULT '{}',
  game_id text NOT NULL,
  server_id text NOT NULL,
  contact_number text NOT NULL,
  expected_price integer NOT NULL CHECK (expected_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packages_game_tab ON public.packages (game, tab, sort_order);
CREATE INDEX IF NOT EXISTS idx_other_packages_active ON public.other_packages (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_accounts_page ON public.accounts (page, published, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);

-- ---------- 2. STORAGE BUCKET ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('account-photos', 'account-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ---------- 3. ORDER RPC FUNCTIONS (visitor flow) ----------

-- Visitors create an order and get the full row (including its generated id) back.
CREATE OR REPLACE FUNCTION public.create_order(
  p_game text,
  p_package_label text,
  p_price integer,
  p_player_id text,
  p_server_id text
)
RETURNS public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.orders (game, package_label, price, player_id, server_id)
  VALUES (p_game, p_package_label, p_price, p_player_id, p_server_id)
  RETURNING *;
$$;

-- Visitors read exactly one order by its exact uuid (the uuid is the capability token).
CREATE OR REPLACE FUNCTION public.get_my_order(p_order_id uuid)
RETURNS public.orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.orders WHERE id = p_order_id;
$$;

-- Admin check helper used by every admin policy.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.create_order(text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_order(text, text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------- 4. RLS ENABLED ON EVERYTHING ----------

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- ---------- 5. GRANTS (least privilege) ----------

-- packages / other_packages: public reads active rows; admins manage.
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packages TO authenticated;

GRANT SELECT ON public.other_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.other_packages TO authenticated;

-- accounts: public reads published rows; admins manage.
GRANT SELECT ON public.accounts TO anon, authenticated;

-- orders: visitors NEVER touch the table directly (RPCs only); admins manage.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

-- account_requests: visitors insert only; admins manage.
GRANT INSERT ON public.account_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.account_requests TO authenticated;

-- admins: a user can read only their own row (policy below).
GRANT SELECT ON public.admins TO authenticated;

-- ---------- 6. PACKAGES POLICIES ----------

DROP POLICY IF EXISTS "public_read_active_packages" ON public.packages;
CREATE POLICY "public_read_active_packages" ON public.packages
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_read_all_packages" ON public.packages;
CREATE POLICY "admin_read_all_packages" ON public.packages
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_packages" ON public.packages;
CREATE POLICY "admin_insert_packages" ON public.packages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_packages" ON public.packages;
CREATE POLICY "admin_update_packages" ON public.packages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_packages" ON public.packages;
CREATE POLICY "admin_delete_packages" ON public.packages
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 7. OTHER_PACKAGES POLICIES ----------

DROP POLICY IF EXISTS "public_read_active_other_packages" ON public.other_packages;
CREATE POLICY "public_read_active_other_packages" ON public.other_packages
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "admin_read_all_other_packages" ON public.other_packages;
CREATE POLICY "admin_read_all_other_packages" ON public.other_packages
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_other_packages" ON public.other_packages;
CREATE POLICY "admin_insert_other_packages" ON public.other_packages
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_other_packages" ON public.other_packages;
CREATE POLICY "admin_update_other_packages" ON public.other_packages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_other_packages" ON public.other_packages;
CREATE POLICY "admin_delete_other_packages" ON public.other_packages
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 8. ACCOUNTS POLICIES ----------

DROP POLICY IF EXISTS "public_read_published_accounts" ON public.accounts;
CREATE POLICY "public_read_published_accounts" ON public.accounts
  FOR SELECT TO anon, authenticated USING (published = true);

DROP POLICY IF EXISTS "admin_read_all_accounts" ON public.accounts;
CREATE POLICY "admin_read_all_accounts" ON public.accounts
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_insert_accounts" ON public.accounts;
CREATE POLICY "admin_insert_accounts" ON public.accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_accounts" ON public.accounts;
CREATE POLICY "admin_update_accounts" ON public.accounts
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_accounts" ON public.accounts;
CREATE POLICY "admin_delete_accounts" ON public.accounts
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 9. ORDERS POLICIES ----------

DROP POLICY IF EXISTS "admin_read_orders" ON public.orders;
CREATE POLICY "admin_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_orders" ON public.orders;
CREATE POLICY "admin_update_orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_orders" ON public.orders;
CREATE POLICY "admin_delete_orders" ON public.orders
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 10. ACCOUNT_REQUESTS POLICIES ----------

DROP POLICY IF EXISTS "visitor_insert_account_requests" ON public.account_requests;
CREATE POLICY "visitor_insert_account_requests" ON public.account_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_account_requests" ON public.account_requests;
CREATE POLICY "admin_read_account_requests" ON public.account_requests
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_account_requests" ON public.account_requests;
CREATE POLICY "admin_update_account_requests" ON public.account_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_account_requests" ON public.account_requests;
CREATE POLICY "admin_delete_account_requests" ON public.account_requests
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---------- 11. ADMINS POLICY ----------

DROP POLICY IF EXISTS "admins_read_own_row" ON public.admins;
CREATE POLICY "admins_read_own_row" ON public.admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---------- 12. STORAGE POLICIES (account-photos) ----------

-- Public read: the site displays the photos.
DROP POLICY IF EXISTS "public_read_account_photos" ON storage.objects;
CREATE POLICY "public_read_account_photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'account-photos');

-- Visitors upload ONLY into the requests/ folder (sell-your-account form).
DROP POLICY IF EXISTS "anon_upload_request_photos" ON storage.objects;
CREATE POLICY "anon_upload_request_photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'account-photos' AND (storage.foldername(name))[1] = 'requests');

-- Admin photo management.
DROP POLICY IF EXISTS "admin_insert_account_photos" ON storage.objects;
CREATE POLICY "admin_insert_account_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'account-photos' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_account_photos" ON storage.objects;
CREATE POLICY "admin_update_account_photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'account-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'account-photos' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_account_photos" ON storage.objects;
CREATE POLICY "admin_delete_account_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'account-photos' AND public.is_admin());

-- ---------- 13. REALTIME ON ORDERS ----------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- ---------- 14. SEED PACKAGES (ML + Starlight) ----------
-- Idempotent: each row guarded by NOT EXISTS on its stable key.

-- ML — باقات مضاعفة (only the 4 double packs)
INSERT INTO public.packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'double', NULL, v.label, v.price, v.ord FROM (VALUES
  ('50 + 5', 55, 1),
  ('150 + 15', 155, 2),
  ('250 + 25', 255, 3),
  ('500 + 65', 510, 4)
) AS v(label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages p
  WHERE p.game = 'ml' AND p.tab = 'double' AND p.label = v.label
);

-- ML — باقات أساسية (31 packages, ascending)
INSERT INTO public.packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'basic', NULL, v.label, v.price, v.ord FROM (VALUES
  ('86', 85), ('172', 165), ('257', 245), ('343', 325), ('429', 410),
  ('514', 485), ('600', 570), ('706', 650), ('878', 810), ('963', 895),
  ('1050', 980), ('1135', 1060), ('1220', 1150), ('1412', 1300), ('1584', 1470),
  ('1670', 1530), ('1926', 1780), ('2195', 1930), ('3073', 2750), ('3688', 3250),
  ('4068', 3600), ('5532', 4880), ('6238', 5500), ('7727', 6800), ('8433', 7400),
  ('9288', 8000), ('10080', 8700), ('12976', 11300), ('15077', 12950), ('20074', 17000),
  ('30059', 25000)
) AS v(label, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages p
  WHERE p.game = 'ml' AND p.tab = 'basic' AND p.label = v.label
);

-- Fix sort order for basic (ascending by gem amount)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY label::integer) AS rn
  FROM public.packages
  WHERE game = 'ml' AND tab = 'basic' AND label ~ '^\d+$'
)
UPDATE public.packages SET sort_order = numbered.rn
FROM numbered WHERE public.packages.id = numbered.id;

-- ML — حزم واشتراكات (sub-sections)
INSERT INTO public.packages (game, tab, sub_section, label, price, sort_order)
SELECT 'ml', 'bundles', v.sub, v.label, v.price, v.ord FROM (VALUES
  ('ويكلي باس', 'اشتراك واحد', 90, 1),
  ('ويكلي باس', '3 اشتراكات', 270, 2),
  ('ويكلي باس', '10 اشتراكات', 900, 3),
  ('حزمة أسبوعية', 'حزمة أسبوعية', 55, 1),
  ('حزمة شهرية', 'حزمة شهرية', 250, 1),
  ('حزمة ميا', 'MIYA SKIN', 530, 1)
) AS v(sub, label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages p
  WHERE p.game = 'ml' AND p.tab = 'bundles' AND p.sub_section = v.sub AND p.label = v.label
);

-- Starlight — 9 duration packages
INSERT INTO public.packages (game, tab, sub_section, label, price, sort_order)
SELECT 'starlight', 'starlight', NULL, v.label, v.price, v.ord FROM (VALUES
  ('Starlight — شهر واحد', 180, 1),
  ('Starlight — شهرين', 350, 2),
  ('Starlight — 3 أشهر', 510, 3),
  ('Starlight — 4 أشهر', 670, 4),
  ('Starlight — 5 أشهر', 825, 5),
  ('Starlight — 6 أشهر', 980, 6),
  ('Starlight — 7 أشهر', 1130, 7),
  ('Starlight — 8 أشهر', 1280, 8),
  ('Starlight — 10 أشهر', 1580, 9)
) AS v(label, price, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages p
  WHERE p.game = 'starlight' AND p.label = v.label
);

-- ---------- 15. OWNER ADMIN ----------
-- Requires the user to already exist in Authentication (created from the dashboard).
-- If it does not exist yet, this inserts nothing — create the user first, then re-run.

INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE email = 'marvelarabworld7@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
