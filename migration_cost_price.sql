-- Adds the purchase ("товар келган") price column to menu_items.
-- Sale price is the existing `price` column.
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0;
