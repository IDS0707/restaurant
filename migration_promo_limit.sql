-- Promo usage limit: admin can cap how many times the QR can be redeemed.
--   usage_limit = 0  → unlimited
--   usage_limit > 0  → counter increments on each successful order; once
--                      use_count >= usage_limit the cashier sees "muddat tugagan".
ALTER TABLE promo_discount
  ADD COLUMN IF NOT EXISTS usage_limit INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS use_count   INT DEFAULT 0;
