-- Promo discount type: 'amount' (so'm) or 'percent' (%)
ALTER TABLE promo_discount
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'amount';

-- VIP cards: per-person QR codes that give 100% discount (all items free).
-- Each VIP has first_name + last_name + a unique QR code.
CREATE TABLE IF NOT EXISTS vip_cards (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(40) UNIQUE NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) DEFAULT '',
    is_active   BOOLEAN DEFAULT true,
    use_count   INT DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
