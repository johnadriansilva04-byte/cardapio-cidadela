-- Migration: order idempotency + public insert RLS
-- Run in Supabase SQL Editor. Required BEFORE deploy of the new createOrder code.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Allow any customer (anonymous or logged-in) to place orders via the public menu
CREATE POLICY public_insert_orders ON orders FOR INSERT TO anon,authenticated
  WITH CHECK (true);

CREATE POLICY public_insert_order_items ON order_items FOR INSERT TO anon,authenticated
  WITH CHECK (true);

CREATE POLICY public_insert_order_status_history ON order_status_history FOR INSERT TO anon,authenticated
  WITH CHECK (true);

CREATE POLICY public_insert_cidadela_unlocks ON cidadela_unlocks FOR INSERT TO anon,authenticated
  WITH CHECK (true);

-- Optional: if you also want anonymous users to read their own order status by phone later.
-- CREATE POLICY public_select_orders_by_phone ON orders FOR SELECT TO anon USING (customer_phone IS NOT NULL);
