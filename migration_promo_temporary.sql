-- Temporary promo codes: admin can create multiple codes with optional expiry.
ALTER TABLE promo_discount
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
