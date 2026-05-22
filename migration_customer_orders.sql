-- Customer + delivery fields on orders (for the mobile app / shop flow)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_last_name  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_phone      VARCHAR(30),
  ADD COLUMN IF NOT EXISTS delivery_type       VARCHAR(20) DEFAULT 'pickup', -- 'delivery' or 'pickup'
  ADD COLUMN IF NOT EXISTS delivery_address    TEXT,
  ADD COLUMN IF NOT EXISTS delivery_lat        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng        DOUBLE PRECISION;
