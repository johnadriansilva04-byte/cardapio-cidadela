-- ============================================================
-- MIGRATION: Add structured address columns to orders
-- Adds complement, neighborhood, and city as separate fields
-- so the admin panel can display address details clearly.
-- ============================================================

-- Add new address detail columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_complement TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_neighborhood TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city TEXT DEFAULT '';

-- Add index for neighborhood (useful for filtering/reporting by area)
CREATE INDEX IF NOT EXISTS idx_orders_customer_neighborhood ON orders(customer_neighborhood);
