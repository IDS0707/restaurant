-- Promo QR discount: a global QR code whose discount admin can change anytime.
-- Cashier scans the QR (value = code) just like a referral card; the order
-- pipeline applies the discount via the same scanCard flow.
CREATE TABLE IF NOT EXISTS promo_discount (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(40) UNIQUE NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single default promo if missing
INSERT INTO promo_discount (code, discount_amount, is_active)
SELECT 'PROMO-MAIN', 15000, true
WHERE NOT EXISTS (SELECT 1 FROM promo_discount);
