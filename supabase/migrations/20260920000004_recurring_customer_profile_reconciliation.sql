-- Migration: 20260920000004_recurring_customer_profile_reconciliation.sql
-- 1. Recurring Academy Bookings (recurring_booking_groups table + recurring_group_id on bookings)
-- 2. Customer Blacklist & Risk Profile (is_blacklisted + blacklist_reason on customers)
-- 3. End of Day Cash & Digital Reconciliation (daily_reconciliations table)

-- 1. RECURRING BOOKING GROUPS
CREATE TABLE IF NOT EXISTS recurring_booking_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    repeat_type TEXT NOT NULL, -- 'DAILY', 'WEEKLY', 'CUSTOM_WEEKDAYS'
    weekdays JSONB DEFAULT '[]'::jsonb, -- e.g. ["MON", "WED", "FRI"]
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS recurring_group_id UUID REFERENCES recurring_booking_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_recurring_group_id ON bookings(recurring_group_id);


-- 2. CUSTOMER BLACKLIST & RISK PROFILE
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blacklist_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_blacklist ON customers(is_blacklisted);


-- 3. DAILY RECONCILIATIONS TABLE
CREATE TABLE IF NOT EXISTS daily_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    cash_expected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cash_actual NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    upi_expected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    upi_actual NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    card_expected NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    card_actual NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    variance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CLOSED', -- 'CLOSED', 'VARIANCE_FOUND'
    notes TEXT DEFAULT NULL,
    closed_by TEXT NOT NULL DEFAULT 'Ground Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_date ON daily_reconciliations(date DESC);

-- Enable RLS on daily_reconciliations
ALTER TABLE daily_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reconciliations' AND policyname = 'Allow select daily_reconciliations') THEN
        CREATE POLICY "Allow select daily_reconciliations" ON daily_reconciliations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reconciliations' AND policyname = 'Allow insert daily_reconciliations') THEN
        CREATE POLICY "Allow insert daily_reconciliations" ON daily_reconciliations FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_reconciliations' AND policyname = 'Allow update daily_reconciliations') THEN
        CREATE POLICY "Allow update daily_reconciliations" ON daily_reconciliations FOR UPDATE USING (true);
    END IF;
END $$;
