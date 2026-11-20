/*
# Order access via SECURITY DEFINER RPCs + anon photo uploads for sell requests

1. Why
- The previous "select one order by id" policy relied on a request header that the
  browser client does not send, so visitors could never read their own order.
- INSERT ... RETURNING on orders also fails for anon visitors, because RETURNING
  requires a SELECT privilege/policy on the returned row.

2. Changes
- New function `create_order(p_game, p_package_label, p_price, p_player_id, p_server_id)`
  RETURNS orders: SECURITY DEFINER. Visitors create their order and get the full row
  (including its generated id) back. Table check constraints (game, price) still apply.
- New function `get_my_order(p_order_id uuid)` RETURNS orders: SECURITY DEFINER.
  Returns the single order whose exact uuid is supplied. The uuid acts as the
  capability token: visitors can only ever read the one order whose id they hold,
  never list orders.
- EXECUTE revoked from PUBLIC on both, granted to anon + authenticated.
- RLS on orders simplified:
  - DROP visitor_insert_orders and visitor_select_own_order_by_id (no longer used).
  - New policy: authenticated (owner) can SELECT all orders.
  - REVOKE INSERT ON orders FROM anon (orders are created via create_order only).
  - Owner keeps INSERT/UPDATE/DELETE grants and policies.
- Storage: new policy allowing anon to UPLOAD photos only inside the `requests/`
  folder of the `account-photos` bucket (needed for the "بيع حسابك" form).
  Owner policies already cover all paths.

3. Security notes
- Both RPCs are SECURITY DEFINER with a fixed search_path.
- create_order accepts only scalar fields; constraints validate game and price.
- get_my_order exposes exactly one row only when the caller knows its uuid.
- anon upload is limited to the `requests/` folder of the photo bucket.
*/

-- ---------- Functions ----------
CREATE OR REPLACE FUNCTION public.create_order(
  p_game text,
  p_package_label text,
  p_price integer,
  p_player_id text,
  p_server_id text
)
RETURNS orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO orders (game, package_label, price, player_id, server_id)
  VALUES (p_game, p_package_label, p_price, p_player_id, p_server_id)
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.get_my_order(p_order_id uuid)
RETURNS orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orders WHERE id = p_order_id;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order(text, text, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_order(uuid) TO anon, authenticated;

-- ---------- Orders RLS ----------
DROP POLICY IF EXISTS "visitor_insert_orders" ON orders;
DROP POLICY IF EXISTS "visitor_select_own_order_by_id" ON orders;

DROP POLICY IF EXISTS "owner_select_orders" ON orders;
CREATE POLICY "owner_select_orders" ON orders
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT ON orders FROM anon;

-- ---------- Storage: anon uploads limited to requests/ folder ----------
DROP POLICY IF EXISTS "anon_upload_request_photos" ON storage.objects;
CREATE POLICY "anon_upload_request_photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'account-photos'
    AND (storage.foldername(name))[1] = 'requests'
  );
