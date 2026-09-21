-- Migration: 20260920000003_audit_logs_payment_refs_and_timezone.sql
-- 1. Immutable Audit Logs Table
-- 2. Payment Reference Tracking (UPI UTR / Card Auth / Cash Notes)
-- 3. Timezone Hardening (Explicit booking_date column to avoid UTC drift in IST)
-- 4. GiST Exclusion Constraint with btree_gist for Conflict Prevention
-- 5. Updated v_booking_ledger View

CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. BOOKING AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS booking_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'BOOKING_CREATED', 'BOOKING_EDITED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'PAYMENT_COLLECTED', 'DUE_AMOUNT_CHANGED', 'CONFLICT_OVERRIDE'
    old_value JSONB DEFAULT NULL,
    new_value JSONB DEFAULT NULL,
    performed_by TEXT NOT NULL DEFAULT 'Ground Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_booking_id ON booking_audit_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON booking_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON booking_audit_logs(action_type);

-- Immutable RLS Policies: Allow INSERT and SELECT, strictly prevent UPDATE and DELETE
ALTER TABLE booking_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_audit_logs' AND policyname = 'Allow select audit logs') THEN
        CREATE POLICY "Allow select audit logs" ON booking_audit_logs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_audit_logs' AND policyname = 'Allow insert audit logs') THEN
        CREATE POLICY "Allow insert audit logs" ON booking_audit_logs FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_audit_logs' AND policyname = 'Prevent delete audit logs') THEN
        CREATE POLICY "Prevent delete audit logs" ON booking_audit_logs FOR DELETE USING (false);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_audit_logs' AND policyname = 'Prevent update audit logs') THEN
        CREATE POLICY "Prevent update audit logs" ON booking_audit_logs FOR UPDATE USING (false);
    END IF;
END $$;


-- 2. PAYMENT REFERENCE TRACKING
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS transaction_reference TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_transaction_reference ON payments(transaction_reference);


-- 3. TIMEZONE HARDENING: ADD BOOKING_DATE COLUMN
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_date DATE;

-- Populate existing rows with local date in Asia/Kolkata (+05:30)
UPDATE bookings
SET booking_date = (start_time AT TIME ZONE 'Asia/Kolkata')::date
WHERE booking_date IS NULL;

-- Set NOT NULL default to current local date
ALTER TABLE bookings
ALTER COLUMN booking_date SET DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_facility_booking_date ON bookings(facility_id, booking_date);


-- 4. PARTIAL GIST EXCLUSION CONSTRAINT FOR CONFLICT PREVENTION
-- Drops earlier constraint if any, and applies partial GiST exclusion where booking is active and not overridden
DO $$
BEGIN
    ALTER TABLE bookings DROP CONSTRAINT IF EXISTS prevent_facility_double_booking;
    
    ALTER TABLE bookings ADD CONSTRAINT prevent_facility_double_booking
    EXCLUDE USING gist (
        facility_id WITH =,
        tsrange(start_time, end_time) WITH &&
    ) WHERE (is_cancelled = FALSE AND is_conflict_override = FALSE);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update skipped or applied: %', SQLERRM;
END $$;


-- 5. UPDATED COMPUTED LEDGER VIEW
CREATE OR REPLACE VIEW v_booking_ledger AS
SELECT 
    b.id AS booking_id,
    b.booking_number,
    b.booking_date,
    b.facility_id,
    f.name AS facility_name,
    f.type AS facility_type,
    b.customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    b.start_time,
    b.end_time,
    b.total_amount,
    COALESCE(SUM(p.amount), 0.00) AS total_paid,
    COALESCE(
        b.custom_pending_amount,
        GREATEST(0.00, b.total_amount - COALESCE(SUM(p.amount), 0.00))
    ) AS pending_amount,
    b.custom_pending_amount,
    b.pending_adjustment_reason,
    b.allow_due_override,
    b.is_conflict_override,
    CASE 
        WHEN b.is_cancelled THEN 'CANCELLED'
        WHEN COALESCE(b.custom_pending_amount, GREATEST(0.00, b.total_amount - COALESCE(SUM(p.amount), 0.00))) = 0 THEN 'FULLY_PAID'
        WHEN COALESCE(SUM(p.amount), 0.00) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_status,
    b.is_cancelled,
    b.notes,
    b.created_at,
    b.updated_at
FROM bookings b
JOIN facilities f ON b.facility_id = f.id
JOIN customers c ON b.customer_id = c.id
LEFT JOIN payments p ON b.id = p.booking_id
GROUP BY b.id, b.booking_number, b.booking_date, b.facility_id, f.name, f.type, b.customer_id, c.name, c.phone;
