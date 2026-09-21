-- Migration: Add is_conflict_override, updated_at tracking, and performance indexes
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS is_conflict_override BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes to prevent slow queries
CREATE INDEX IF NOT EXISTS idx_bookings_facility_id ON bookings(facility_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_end_time ON bookings(end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);

-- Update the financial ledger view to include is_conflict_override & updated_at
CREATE OR REPLACE VIEW v_booking_ledger AS
SELECT 
    b.id AS booking_id,
    b.facility_id,
    f.name AS facility_name,
    f.type AS facility_type,
    b.customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    b.start_time,
    b.end_time,
    b.total_amount,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    COALESCE(
        b.custom_pending_amount,
        GREATEST(0, b.total_amount - COALESCE(SUM(p.amount), 0))
    ) AS pending_amount,
    b.custom_pending_amount,
    b.pending_adjustment_reason,
    b.allow_due_override,
    b.is_conflict_override,
    CASE 
        WHEN b.is_cancelled THEN 'CANCELLED'
        WHEN COALESCE(b.custom_pending_amount, GREATEST(0, b.total_amount - COALESCE(SUM(p.amount), 0))) = 0 THEN 'FULLY_PAID'
        WHEN COALESCE(SUM(p.amount), 0) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'PENDING'
    END AS payment_status,
    b.is_cancelled,
    b.created_at,
    b.updated_at
FROM bookings b
JOIN facilities f ON b.facility_id = f.id
JOIN customers c ON b.customer_id = c.id
LEFT JOIN payments p ON b.id = p.booking_id
GROUP BY b.id, f.name, f.type, c.name, c.phone;
