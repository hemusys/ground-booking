-- Migration: 20260920000001_add_custom_pending_balance.sql
-- Adds manual pending balance override and adjustment audit columns

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS custom_pending_amount NUMERIC(10, 2) DEFAULT NULL CHECK (custom_pending_amount >= 0),
ADD COLUMN IF NOT EXISTS pending_adjustment_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS allow_due_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Update Computed Ledger View to respect custom_pending_amount override
CREATE OR REPLACE VIEW v_booking_ledger AS
SELECT 
    b.id AS booking_id,
    b.facility_id,
    b.customer_id,
    b.start_time,
    b.end_time,
    b.total_amount,
    b.custom_pending_amount,
    b.pending_adjustment_reason,
    b.allow_due_override,
    b.is_cancelled,
    COALESCE(SUM(p.amount), 0.00) AS total_paid,
    CASE 
        WHEN b.custom_pending_amount IS NOT NULL THEN GREATEST(0.00, b.custom_pending_amount)
        ELSE GREATEST(0.00, b.total_amount - COALESCE(SUM(p.amount), 0.00))
    END AS pending_amount,
    CASE 
        WHEN (b.custom_pending_amount IS NOT NULL AND b.custom_pending_amount = 0) OR (COALESCE(SUM(p.amount), 0.00) >= b.total_amount AND b.total_amount > 0) THEN 'FULLY_PAID'
        WHEN COALESCE(SUM(p.amount), 0.00) > 0 OR (b.custom_pending_amount IS NOT NULL AND b.custom_pending_amount < b.total_amount) THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_status
FROM bookings b
LEFT JOIN payments p ON b.id = p.booking_id
GROUP BY b.id;
