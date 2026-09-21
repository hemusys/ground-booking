import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createQuickBooking, 
  updateBooking, 
  recordPayment, 
  cancelBooking, 
  updateBookingPendingBalance, 
  fetchBookingAuditLogs,
  fetchBookings,
  hasBookingConflict,
  initializeStorage
} from '../lib/api';
import { 
  formatWhatsAppPhone, 
  interpolateReminderTemplate, 
  buildWhatsAppDueReminderLink, 
  DEFAULT_REMINDER_TEMPLATE 
} from '../lib/whatsapp';
import { Booking, QuickBookFormData, EditBookingFormData } from '../types';
import { createSafeBookingInterval } from '../lib/time';

describe('FEATURE 1 — Immutable Booking Audit Log', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('records BOOKING_CREATED audit log upon booking creation', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Audit Player',
      customer_phone: '9876500001',
      total_amount: 3000,
      advance_paid: 1000,
      payment_method: 'UPI',
      transaction_reference: 'UPI/999111222333',
    };

    const booking = await createQuickBooking(formData);
    const logs = await fetchBookingAuditLogs(booking.id);

    expect(logs.length).toBeGreaterThanOrEqual(2); // BOOKING_CREATED and PAYMENT_COLLECTED (for advance)
    const createdLog = logs.find(l => l.action_type === 'BOOKING_CREATED');
    expect(createdLog).toBeDefined();
    expect(createdLog?.performed_by).toBe('Ground Admin');
    expect(createdLog?.new_value?.total_amount).toBe(3000);
  });

  it('records PAYMENT_COLLECTED with transaction reference in audit log', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-2',
      date: '2026-09-21',
      start_time: '09:00',
      end_time: '10:00',
      customer_name: 'Payment Player',
      customer_phone: '9876500002',
      total_amount: 500,
      advance_paid: 0,
      payment_method: 'UPI',
    };

    const booking = await createQuickBooking(formData);
    await recordPayment(booking.id, 500, 'CARD', 'POS settlement', 'POS-AUTH-7788');

    const logs = await fetchBookingAuditLogs(booking.id);
    const payLog = logs.find(l => l.action_type === 'PAYMENT_COLLECTED');
    expect(payLog).toBeDefined();
    expect(payLog?.new_value?.amount).toBe(500);
    expect(payLog?.new_value?.payment_method).toBe('CARD');
    expect(payLog?.new_value?.transaction_reference).toBe('POS-AUTH-7788');
  });

  it('records BOOKING_RESCHEDULED and BOOKING_EDITED appropriately', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '14:00',
      end_time: '16:00',
      customer_name: 'Reschedule Player',
      customer_phone: '9876500003',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    };

    const booking = await createQuickBooking(formData);

    // Reschedule time
    const rescheduleData: EditBookingFormData = {
      booking_id: booking.id,
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '15:00',
      end_time: '17:00',
      customer_name: 'Reschedule Player',
      customer_phone: '9876500003',
      total_amount: 3000,
    };
    await updateBooking(rescheduleData);

    const logs = await fetchBookingAuditLogs(booking.id);
    const reschedLog = logs.find(l => l.action_type === 'BOOKING_RESCHEDULED');
    expect(reschedLog).toBeDefined();
  });

  it('records DUE_AMOUNT_CHANGED audit log with reason and previous balance', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '10:00',
      end_time: '12:00',
      customer_name: 'Adjustment Player',
      customer_phone: '9876500004',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    };

    const booking = await createQuickBooking(formData);
    await updateBookingPendingBalance(booking.id, 2500, 'Academy loyalty discount applied');

    const logs = await fetchBookingAuditLogs(booking.id);
    const dueLog = logs.find(l => l.action_type === 'DUE_AMOUNT_CHANGED');
    expect(dueLog).toBeDefined();
    expect(dueLog?.new_value?.new_due).toBe(2500);
    expect(dueLog?.new_value?.reason).toBe('Academy loyalty discount applied');
  });

  it('records BOOKING_CANCELLED and CONFLICT_OVERRIDE audit actions', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '18:00',
      end_time: '20:00',
      customer_name: 'Cancel Player',
      customer_phone: '9876500005',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
      is_conflict_override: true,
    };

    const booking = await createQuickBooking(formData);
    await cancelBooking(booking.id);

    const logs = await fetchBookingAuditLogs(booking.id);
    const cancelLog = logs.find(l => l.action_type === 'BOOKING_CANCELLED');
    const overrideLog = logs.find(l => l.action_type === 'CONFLICT_OVERRIDE');

    expect(cancelLog).toBeDefined();
    expect(overrideLog).toBeDefined();
  });
});

describe('FEATURE 2 — Payment Reference Tracking', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('persists transaction_reference and payment_notes for UPI / Card payments', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-2',
      date: '2026-09-21',
      start_time: '07:00',
      end_time: '08:00',
      customer_name: 'UPI Tester',
      customer_phone: '9876500010',
      total_amount: 500,
      advance_paid: 200,
      payment_method: 'UPI',
      transaction_reference: 'UPI/UTR-554433221100',
    };

    const booking = await createQuickBooking(formData);
    const payment = await recordPayment(
      booking.id, 
      300, 
      'CARD', 
      'Counter card terminal swipe', 
      'AUTH-990011'
    );

    expect(payment.transaction_reference).toBe('AUTH-990011');
    expect(payment.payment_notes).toBe('Counter card terminal swipe');
    expect(payment.amount).toBe(300);

    const all = await fetchBookings();
    const updatedBooking = all.find(b => b.id === booking.id);
    expect(updatedBooking?.payments?.length).toBe(2);
    expect(updatedBooking?.pending_amount).toBe(0);
    expect(updatedBooking?.payment_status).toBe('FULLY_PAID');
  });

  it('handles cash payments with optional notes and null transaction_reference', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-2',
      date: '2026-09-21',
      start_time: '08:00',
      end_time: '09:00',
      customer_name: 'Cash Tester',
      customer_phone: '9876500011',
      total_amount: 500,
      advance_paid: 0,
      payment_method: 'CASH',
    };

    const booking = await createQuickBooking(formData);
    const payment = await recordPayment(
      booking.id, 
      500, 
      'CASH', 
      'Handed ₹500 currency note to pitch supervisor'
    );

    expect(payment.payment_method).toBe('CASH');
    expect(payment.transaction_reference).toBeNull();
    expect(payment.payment_notes).toBe('Handed ₹500 currency note to pitch supervisor');
  });
});

describe('FEATURE 3 — WhatsApp Due Reminder System', () => {
  it('formats Indian 10-digit mobile numbers with 91 prefix for WhatsApp wa.me links', () => {
    expect(formatWhatsAppPhone('9876543210')).toBe('919876543210');
    expect(formatWhatsAppPhone('+91 98765 43210')).toBe('919876543210');
    expect(formatWhatsAppPhone('919876543210')).toBe('919876543210');
  });

  it('interpolates template placeholders accurately in reminder messages', () => {
    const text = interpolateReminderTemplate(DEFAULT_REMINDER_TEMPLATE, {
      phone: '9876543210',
      customerName: 'Suresh Raina',
      facilityName: 'Main Turf Pitch',
      startIso: '2026-09-21T06:00:00.000Z',
      endIso: '2026-09-21T10:00:00.000Z',
      totalAmount: 6000,
      advancePaid: 2000,
      pendingAmount: 4000,
      groundName: 'Wankhede Nets Arena',
    });

    expect(text).toContain('Wankhede Nets Arena');
    expect(text).toContain('Suresh Raina');
    expect(text).toContain('Main Turf Pitch');
    expect(text).toContain('₹6,000');
    expect(text).toContain('₹2,000');
    expect(text).toContain('Pending Due: ₹4,000');
  });

  it('generates valid URL-encoded wa.me deep links for reminders', () => {
    const link = buildWhatsAppDueReminderLink({
      phone: '9876543210',
      customerName: 'MS Dhoni',
      facilityName: 'Net 1',
      startIso: '2026-09-21T06:00:00.000Z',
      endIso: '2026-09-21T07:30:00.000Z',
      totalAmount: 750,
      advancePaid: 0,
      pendingAmount: 750,
      groundName: 'Ranchi Sports Hub',
    });

    expect(link.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(link).toContain(encodeURIComponent('Ranchi Sports Hub'));
    expect(link).toContain(encodeURIComponent('MS Dhoni'));
  });
});

describe('FEATURE 4 — Timezone Hardening (IST +05:30)', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('persists explicit booking_date matching local date string regardless of ISO hour', async () => {
    // 5:30 AM local time on 2026-09-21
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '05:30',
      end_time: '07:30',
      customer_name: 'Morning Star',
      customer_phone: '9876599999',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    };

    const booking = await createQuickBooking(formData);
    expect(booking.booking_date).toBe('2026-09-21');

    // Querying specifically for 2026-09-21 returns this booking
    const bookingsOnDate = await fetchBookings('2026-09-21');
    const found = bookingsOnDate.find(b => b.id === booking.id);
    expect(found).toBeDefined();
    expect(found?.booking_date).toBe('2026-09-21');

    // Querying for previous day 2026-09-20 does NOT return it
    const bookingsPrevDay = await fetchBookings('2026-09-20');
    const notFound = bookingsPrevDay.find(b => b.id === booking.id);
    expect(notFound).toBeUndefined();
  });
});

describe('FEATURE 5 — Database & App Conflict Rules (GiST logic)', () => {
  const { startIso: baseStart, endIso: baseEnd } = createSafeBookingInterval('2026-09-21', '06:00', '08:00');

  const existingBookings: Booking[] = [
    {
      id: 'b-exist-1',
      facility_id: 'f-1',
      customer_id: 'c-1',
      booking_date: '2026-09-21',
      start_time: baseStart,
      end_time: baseEnd, // 06:00 - 08:00
      total_amount: 3000,
      is_cancelled: false,
      created_at: new Date().toISOString(),
    }
  ];

  it('allows touching boundaries where End Time of Booking A equals Start Time of Booking B', () => {
    // Booking B starts at 08:00 and ends at 10:00 -> Allowed
    const boundaryCheck = hasBookingConflict(
      'f-1',
      '2026-09-21',
      '08:00',
      '10:00',
      undefined,
      existingBookings
    );
    expect(boundaryCheck.hasConflict).toBe(false);

    // Booking C starts at 04:00 and ends at 06:00 -> Allowed
    const preBoundaryCheck = hasBookingConflict(
      'f-1',
      '2026-09-21',
      '04:00',
      '06:00',
      undefined,
      existingBookings
    );
    expect(preBoundaryCheck.hasConflict).toBe(false);
  });

  it('detects interior and partial overlap conflicts', () => {
    // Partial overlap: 07:00 to 09:00 -> Conflict
    const overlap1 = hasBookingConflict('f-1', '2026-09-21', '07:00', '09:00', undefined, existingBookings);
    expect(overlap1.hasConflict).toBe(true);

    // Interior overlap: 06:30 to 07:30 -> Conflict
    const overlap2 = hasBookingConflict('f-1', '2026-09-21', '06:30', '07:30', undefined, existingBookings);
    expect(overlap2.hasConflict).toBe(true);

    // Complete enclosing overlap: 05:00 to 09:00 -> Conflict
    const overlap3 = hasBookingConflict('f-1', '2026-09-21', '05:00', '09:00', undefined, existingBookings);
    expect(overlap3.hasConflict).toBe(true);
  });

  it('allows conflict override when is_conflict_override is true and records override flag', async () => {
    initializeStorage(true, false);

    // 1. Create first booking 06:00 - 08:00
    await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Slot Owner 1',
      customer_phone: '9876540001',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    });

    // 2. Attempt double booking 07:00 - 09:00 without override -> Throws
    await expect(
      createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-21',
        start_time: '07:00',
        end_time: '09:00',
        customer_name: 'Slot Owner 2',
        customer_phone: '9876540002',
        total_amount: 3000,
        advance_paid: 0,
        payment_method: 'UPI',
        is_conflict_override: false,
      })
    ).rejects.toThrow('Facility already booked');

    // 3. Attempt with is_conflict_override = true -> Succeeds
    const overrideBooking = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '07:00',
      end_time: '09:00',
      customer_name: 'Slot Owner 2 Override',
      customer_phone: '9876540002',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
      is_conflict_override: true,
    });

    expect(overrideBooking.is_conflict_override).toBe(true);
  });
});
