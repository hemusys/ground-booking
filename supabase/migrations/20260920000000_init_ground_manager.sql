-- Ground Manager Database Schema & Migration (PostgreSQL / Supabase)
-- 4 Tables: facilities, customers, bookings, payments + v_booking_ledger view

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. Facilities
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'NET', -- 'GROUND', 'NET', 'TURF_NET'
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 500.00 CHECK (hourly_rate >= 0),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    team_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 3. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number SERIAL UNIQUE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    notes TEXT,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_window CHECK (end_time > start_time)
);

-- DOUBLE BOOKING HARD LOCK: Prevents overlapping active bookings on the same facility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prevent_facility_double_booking'
    ) THEN
        ALTER TABLE bookings ADD CONSTRAINT prevent_facility_double_booking
        EXCLUDE USING gist (
            facility_id WITH =,
            tsrange(start_time, end_time) WITH &&
        ) WHERE (is_cancelled = FALSE);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_facility_time ON bookings(facility_id, start_time, end_time);

-- 4. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'UPI', -- 'UPI', 'CASH', 'CARD'
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);

-- 5. Computed Ledger View
CREATE OR REPLACE VIEW v_booking_ledger AS
SELECT 
    b.id AS booking_id,
    b.facility_id,
    b.customer_id,
    b.start_time,
    b.end_time,
    b.total_amount,
    b.is_cancelled,
    COALESCE(SUM(p.amount), 0.00) AS total_paid,
    GREATEST(0.00, b.total_amount - COALESCE(SUM(p.amount), 0.00)) AS pending_amount,
    CASE 
        WHEN COALESCE(SUM(p.amount), 0.00) >= b.total_amount AND b.total_amount > 0 THEN 'FULLY_PAID'
        WHEN COALESCE(SUM(p.amount), 0.00) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_status
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
GROUP BY b.id;

-- 6. Initial Seed Facilities
INSERT INTO facilities (name, type, hourly_rate, display_order)
VALUES
    ('Main Ground', 'GROUND', 1500.00, 1),
    ('Net 1', 'NET', 500.00, 2),
    ('Net 2', 'NET', 500.00, 3),
    ('Net 4', 'NET', 500.00, 5),
    ('Net 5', 'NET', 500.00, 6),
    ('Turf Net 1', 'TURF_NET', 700.00, 7),
    ('Turf Net 2', 'TURF_NET', 800.00, 8)
ON CONFLICT DO NOTHING;
