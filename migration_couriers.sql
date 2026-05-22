-- Couriers (delivery riders) — separate accounts that pick up ready orders.
CREATE TABLE IF NOT EXISTS couriers (
  id           SERIAL PRIMARY KEY,
  phone        VARCHAR(20) UNIQUE NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100),
  pin          VARCHAR(20) NOT NULL,
  is_active    BOOLEAN     DEFAULT TRUE,
  current_lat  DOUBLE PRECISION,
  current_lng  DOUBLE PRECISION,
  last_seen_at TIMESTAMP,
  created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS courier_id INTEGER NULL REFERENCES couriers(id) ON DELETE SET NULL;
