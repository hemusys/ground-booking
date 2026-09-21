import { describe, it, expect } from 'vitest';
import { createSafeBookingInterval, formatDurationLabel, generateTimeSlots, formatTime12Hour } from '../lib/time';
import { computeBookingFinancials } from '../lib/api';
import { quickBookingSchema } from '../lib/schemas';
import { Booking, Payment } from '../types';

describe('1. Quick Duration & Time Calculations', () => {
  it('generates 30-minute time slots from 5:00 AM to 11:00 PM', () => {
    const slots = generateTimeSlots(5, 23, 30);
    expect(slots.length).toBe(37);
    expect(slots[0]).toEqual({ value: '05:00', label: '5:00 AM' });
    expect(slots[1]).toEqual({ value: '05:30', label: '5:30 AM' });
    expect(slots[slots.length - 1]).toEqual({ value: '23:00', label: '11:00 PM' });
    expect(formatTime12Hour('18:30')).toBe('6:30 PM');
    expect(formatTime12Hour('12:00')).toBe('12:00 PM');
    expect(formatTime12Hour('00:00')).toBe('12:00 AM');
  });

  it('correctly calculates duration between start time and end time', () => {
    const { durationMins } = createSafeBookingInterval('2026-09-20', '06:00', '07:30');
    expect(durationMins).toBe(90);
    expect(formatDurationLabel(durationMins)).toBe('1 hr 30 mins');
  });

  it('correctly calculates duration for 4-hour match', () => {
    const { durationMins } = createSafeBookingInterval('2026-09-20', '06:00', '10:00');
    expect(durationMins).toBe(240);
    expect(formatDurationLabel(durationMins)).toBe('4 hrs');
  });

  it('handles midnight-crossing night matches by rolling to next day', () => {
    const { startIso, endIso, durationMins } = createSafeBookingInterval('2026-09-20', '22:00', '02:00');
    expect(durationMins).toBe(240); // 4 hours from 10 PM to 2 AM
    expect(new Date(endIso).getTime()).toBeGreaterThan(new Date(startIso).getTime());
  });

  it('rejects same-day end time earlier than or equal to start time in zod validation', () => {
    const invalidData = {
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '18:00',
      end_time: '17:00', // Invalid: earlier
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 1000,
      advance_paid: 0,
      payment_method: 'UPI' as const,
    };

    const result = quickBookingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('end_time'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('End time must be after start time');
    }
  });
});

describe('2. Pending Balance & Custom Due Validation', () => {
  it('validates natural pending balance when advance is paid', () => {
    const validData = {
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 2000,
      advance_paid: 500,
      custom_pending_amount: 1500, // Matches 2000 - 500
      payment_method: 'UPI' as const,
    };

    const result = quickBookingSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects negative pending balance', () => {
    const invalidData = {
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 2000,
      advance_paid: 500,
      custom_pending_amount: -100, // Invalid: negative
      payment_method: 'UPI' as const,
    };

    const result = quickBookingSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('requires adjustment reason when custom due differs from calculated balance', () => {
    const withoutReason = {
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 2000,
      advance_paid: 500,
      custom_pending_amount: 1200, // Differs from 1500
      pending_adjustment_reason: '', // Missing reason
      payment_method: 'UPI' as const,
    };

    const result = quickBookingSchema.safeParse(withoutReason);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes('pending_adjustment_reason'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain('Adjustment reason is required');
    }

    const withReason = {
      ...withoutReason,
      pending_adjustment_reason: 'Granted ₹300 academy discount',
    };
    const validResult = quickBookingSchema.safeParse(withReason);
    expect(validResult.success).toBe(true);
  });

  it('allows user to manually set Due = 800, Due = 1200, or Due = 0 with adjustment reason', () => {
    // Due = 800 (Discounted from 1500 - 500 = 1000)
    const due800 = quickBookingSchema.safeParse({
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 1500,
      advance_paid: 500,
      custom_pending_amount: 800,
      pending_adjustment_reason: 'Discount',
      payment_method: 'UPI' as const,
    });
    expect(due800.success).toBe(true);

    // Due = 1200 (Extra charge added: from 1500 - 500 = 1000)
    const due1200 = quickBookingSchema.safeParse({
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 1500,
      advance_paid: 500,
      custom_pending_amount: 1200,
      pending_adjustment_reason: 'Floodlight Charges',
      payment_method: 'UPI' as const,
    });
    expect(due1200.success).toBe(true);

    // Due = 0 (Full waiver)
    const due0 = quickBookingSchema.safeParse({
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 1500,
      advance_paid: 500,
      custom_pending_amount: 0,
      pending_adjustment_reason: 'Customer Credit',
      payment_method: 'UPI' as const,
    });
    expect(due0.success).toBe(true);
  });

  it('rejects due > total fee unless allow_due_override is true', () => {
    const excessDue = {
      facility_id: 'f-1',
      date: '2026-09-20',
      start_time: '06:00',
      end_time: '08:00',
      customer_phone: '9876543210',
      customer_name: 'Rahul Verma',
      total_amount: 2000,
      advance_paid: 0,
      custom_pending_amount: 2500, // Exceeds total
      pending_adjustment_reason: 'Late cancellation penalty added',
      allow_due_override: false,
      payment_method: 'UPI' as const,
    };

    const result = quickBookingSchema.safeParse(excessDue);
    expect(result.success).toBe(false);

    // With explicit override allowed:
    const allowed = {
      ...excessDue,
      allow_due_override: true,
    };
    const allowedResult = quickBookingSchema.safeParse(allowed);
    expect(allowedResult.success).toBe(true);
  });
});

describe('3. Ledger Financial Computations', () => {
  it('computes FULLY_PAID when advance equals total amount', () => {
    const booking: Booking = {
      id: 'b-test-1',
      facility_id: 'f-1',
      customer_id: 'c-1',
      booking_date: '2026-09-20',
      start_time: '2026-09-20T06:00:00.000Z',
      end_time: '2026-09-20T08:00:00.000Z',
      total_amount: 2000,
      is_cancelled: false,
      created_at: new Date().toISOString(),
    };
    const payments: Payment[] = [
      { id: 'p-1', booking_id: 'b-test-1', amount: 2000, payment_method: 'UPI', created_at: new Date().toISOString() },
    ];

    const financials = computeBookingFinancials(booking, payments);
    expect(financials.total_paid).toBe(2000);
    expect(financials.pending_amount).toBe(0);
    expect(financials.payment_status).toBe('FULLY_PAID');
  });

  it('respects custom pending amount override', () => {
    const booking: Booking = {
      id: 'b-test-2',
      facility_id: 'f-1',
      customer_id: 'c-1',
      booking_date: '2026-09-20',
      start_time: '2026-09-20T06:00:00.000Z',
      end_time: '2026-09-20T08:00:00.000Z',
      total_amount: 2000,
      custom_pending_amount: 800, // Manually adjusted due
      pending_adjustment_reason: 'Special concession',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    };
    const payments: Payment[] = [
      { id: 'p-1', booking_id: 'b-test-2', amount: 500, payment_method: 'UPI', created_at: new Date().toISOString() },
    ];

    const financials = computeBookingFinancials(booking, payments);
    expect(financials.total_paid).toBe(500);
    expect(financials.pending_amount).toBe(800);
    expect(financials.payment_status).toBe('PARTIALLY_PAID');
  });
});
