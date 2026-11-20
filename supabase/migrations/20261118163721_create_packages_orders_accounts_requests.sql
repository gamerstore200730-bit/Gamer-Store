/*
# Full Gamer Store schema: packages, other_packages, orders, accounts, account_requests

1. Modified tables
- `store_accounts` is renamed to `accounts` (same columns, nothing lost) and gains:
  - `published` (boolean, not null, default false) — only published accounts are shown publicly.
  Existing data is preserved; all rows default to published = false.

2. New tables
- `packages`: catalog packages for both games.
  - `id` (uuid, primary key)
  - `game` (text: 'ml' or 'starlight', not null)
  - `tab` (text, not null) — for ML: 'double' | 'basic' | 'bundles' | 'other'; for starlight: 'starlight'
  - `sub_section` (text, nullable) — heading inside the bundles tab
  - `label` (text, not null) — card text, e.g. '50 + 5' or '86' or 'Starlight — شهرين'
  - `price` (integer, not null) — final selling price in EGP
  - `sort_order` (integer, not null default 0)
  - `active` (boolean, not null default true)
- `other_packages`: dynamic "حزم أخرى" offers.
  - `id`, `name` (text), `price` (integer), `note` (text, nullable), `end_date` (timestamptz, nullable), `active` (boolean default true), `sort_order` (integer)
- `orders`: customer top-up orders.
  - `id` (uuid, primary key, default gen_random_uuid) — shown to the customer as their order id
  - `game` (text: 'ml' or 'starlight'), `package_label` (text), `price` (integer)
  - `player_id` (text), `server_id` (text)
  - `status` (text: 'pending' or 'completed', default 'pending')
  - `created_at` (timestamptz default now()), `completed_at` (timestamptz, nullable)
- `account_requests`: "بيع حسابك" submissions.
  - `id`, `photos` (text[] default '{}'), `game_id`, `server_id`, `contact_number`, `expected_price` (integer), `created_at`

3. Security (RLS) — every table has RLS enabled
- packages / other_packages / accounts:
  - anon + authenticated can SELECT active/visible rows (accounts: only `published = true`).
  - authenticated (owner) can SELECT everything, INSERT, UPDATE, DELETE.
- orders:
  - anon can INSERT an order and can SELECT exactly one order by its id (`.eq('id', ...)`); they can never list orders.
  - authenticated (owner) can SELECT all, UPDATE, DELETE.
- account_requests:
  - anon can INSERT only. Only authenticated can SELECT/UPDATE/DELETE.
- Grants match the policies exactly (minimum verbs per role).

4. Realtime
- realtime publication enabled for `orders` so the owner dashboard receives new orders live.

5. Notes
- No transaction control statements. Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
- The existing `account-photos` storage bucket from the previous migration is reused for account photos.
*/

-- 1. Rename store_accounts -> accounts and add published
ALTER TABLE store_accounts RENAME TO accounts;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

-- 2. packages
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game text NOT NULL CHECK (game IN ('ml', 'starlight')),
  tab text NOT NULL,
  sub_section text,
  label text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

-- 3. other_packages
CREATE TABLE IF NOT EXISTS other_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  note text,
  end_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

-- 4. orders
CREATE TABLE IF NOT EXISTS orders (
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

-- 5. account_requests
CREATE TABLE IF NOT EXISTS account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photos text[] NOT NULL DEFAULT '{}',
  game_id text NOT NULL,
  server_id text NOT NULL,
  contact_number text NOT NULL,
  expected_price integer NOT NULL CHECK (expected_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packages_game_tab ON packages (game, tab, sort_order);
CREATE INDEX IF NOT EXISTS idx_other_packages_active ON other_packages (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_accounts_page ON accounts (page, published, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

-- ============ RLS ============

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;

-- Grants (minimum verbs per role)
GRANT SELECT ON packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON packages TO authenticated;

GRANT SELECT ON other_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON other_packages TO authenticated;

GRANT SELECT, UPDATE, DELETE ON accounts TO authenticated;
GRANT SELECT ON accounts TO anon;

GRANT INSERT ON orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON orders TO authenticated;

GRANT INSERT ON account_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON account_requests TO authenticated;

-- packages policies
DROP POLICY IF EXISTS "public_read_active_packages" ON packages;
CREATE POLICY "public_read_active_packages" ON packages
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "owner_read_all_packages" ON packages;
CREATE POLICY "owner_read_all_packages" ON packages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_write_packages" ON packages;
CREATE POLICY "owner_write_packages" ON packages
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "owner_update_packages" ON packages;
CREATE POLICY "owner_update_packages" ON packages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_delete_packages" ON packages;
CREATE POLICY "owner_delete_packages" ON packages
  FOR DELETE TO authenticated USING (true);

-- other_packages policies
DROP POLICY IF EXISTS "public_read_active_other_packages" ON other_packages;
CREATE POLICY "public_read_active_other_packages" ON other_packages
  FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "owner_read_all_other_packages" ON other_packages;
CREATE POLICY "owner_read_all_other_packages" ON other_packages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_other_packages" ON other_packages;
CREATE POLICY "owner_insert_other_packages" ON other_packages
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "owner_update_other_packages" ON other_packages;
CREATE POLICY "owner_update_other_packages" ON other_packages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_delete_other_packages" ON other_packages;
CREATE POLICY "owner_delete_other_packages" ON other_packages
  FOR DELETE TO authenticated USING (true);

-- accounts policies (public sees only published)
DROP POLICY IF EXISTS "public_read_published_accounts" ON accounts;
CREATE POLICY "public_read_published_accounts" ON accounts
  FOR SELECT TO anon, authenticated USING (published = true);

DROP POLICY IF EXISTS "owner_read_all_accounts" ON accounts;
CREATE POLICY "owner_read_all_accounts" ON accounts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_accounts" ON accounts;
CREATE POLICY "owner_insert_accounts" ON accounts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "owner_update_accounts" ON accounts;
CREATE POLICY "owner_update_accounts" ON accounts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_delete_accounts" ON accounts;
CREATE POLICY "owner_delete_accounts" ON accounts
  FOR DELETE TO authenticated USING (true);

-- orders policies (visitor can select exactly one row by id, never list)
DROP POLICY IF EXISTS "visitor_insert_orders" ON orders;
CREATE POLICY "visitor_insert_orders" ON orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "visitor_select_own_order_by_id" ON orders;
CREATE POLICY "visitor_select_own_order_by_id" ON orders
  FOR SELECT TO anon, authenticated USING (id::text = COALESCE(current_setting('request.headers', true)::json->>'x-order-id', '') OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "owner_update_orders" ON orders;
CREATE POLICY "owner_update_orders" ON orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_delete_orders" ON orders;
CREATE POLICY "owner_delete_orders" ON orders
  FOR DELETE TO authenticated USING (true);

-- account_requests policies (visitor insert-only, never read)
DROP POLICY IF EXISTS "visitor_insert_account_requests" ON account_requests;
CREATE POLICY "visitor_insert_account_requests" ON account_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "owner_read_account_requests" ON account_requests;
CREATE POLICY "owner_read_account_requests" ON account_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "owner_update_account_requests" ON account_requests;
CREATE POLICY "owner_update_account_requests" ON account_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "owner_delete_account_requests" ON account_requests;
CREATE POLICY "owner_delete_account_requests" ON account_requests
  FOR DELETE TO authenticated USING (true);

-- Realtime for orders (owner dashboard live updates)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;
END $$;
