-- Inventory System Migration
-- Run on existing database: psql -U postgres -d youit -f migration_inventory.sql

-- Add new columns to expenses if missing (expense_type + is_recurring)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_type VARCHAR(50) DEFAULT 'one_time';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Add food cost + markup to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS food_cost DECIMAL(10,2) DEFAULT 0;

-- Warehouse: ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    category            VARCHAR(100) DEFAULT 'Умумий',
    measurement_unit    VARCHAR(20)  NOT NULL,          -- kg, g, liter, ml, pcs, 10g
    quantity            DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit_price          DECIMAL(10,2) NOT NULL DEFAULT 0,
    low_stock_threshold DECIMAL(12,3) DEFAULT 5,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase history (each restock creates a row here)
CREATE TABLE IF NOT EXISTS ingredient_purchases (
    id                 SERIAL PRIMARY KEY,
    ingredient_id      INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_purchased DECIMAL(12,3) NOT NULL,
    unit_price         DECIMAL(10,2) NOT NULL,
    total_cost         DECIMAL(12,2) NOT NULL,
    notes              TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipe items: which ingredients a dish uses
CREATE TABLE IF NOT EXISTS recipe_items (
    id            SERIAL PRIMARY KEY,
    menu_item_id  INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity_used DECIMAL(12,3) NOT NULL,
    unit          VARCHAR(20)   NOT NULL,
    UNIQUE(menu_item_id, ingredient_id)
);

-- Inventory movement log
CREATE TABLE IF NOT EXISTS inventory_logs (
    id               SERIAL PRIMARY KEY,
    ingredient_id    INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
    ingredient_name  VARCHAR(255),
    order_id         INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    menu_item_id     INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
    quantity_change  DECIMAL(12,3) NOT NULL,
    action           VARCHAR(50)   NOT NULL,  -- 'purchase', 'sale_deduction', 'manual_adjust'
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
