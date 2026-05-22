-- Customer accounts (one-time registration, phone-based)
CREATE TABLE IF NOT EXISTS customers (
    id          SERIAL PRIMARY KEY,
    phone       VARCHAR(30) UNIQUE NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) DEFAULT '',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved delivery addresses per customer
CREATE TABLE IF NOT EXISTS customer_addresses (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    label       VARCHAR(100) DEFAULT 'Manzil',
    address     TEXT NOT NULL,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    is_default  BOOLEAN DEFAULT false,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link orders to a customer (optional — anonymous orders still allowed)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
