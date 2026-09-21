import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasBookingConflict,
  createQuickBooking,
  updateBooking,
  filterBookings,
  computeBookingFinancials,
  initializeStorage,
} from '../lib/api';
import { createSafeBookingInterval } from '../lib/time';
import { Booking, Facility, EditBookingFormData, BookingSearchFilters } from '../types';

describe('Feature 1: Booking Conflict Detection & Overlap Prevention', () => {
  const facilityId = 'f-1';

  // Base booking: 6:00 PM - 8:00 PM (18:00 - 20:00)
  const { startIso: baseStart, endIso: baseEnd } = createSafeBookingInterval('2026-09-20', '18:00', '20:00');

  const existingBookings: Booking[] = [
    {
      id: 'booking-existing-1',
      facility_id: facilityId,
      customer_id: 'c-1',
      booking_date: '2026-09-20',
      start_time: baseStart,
      end_time: baseEnd,
      total_amount: 3000,
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
  ];

  it('rejects overlapping time slots: 7:00 PM - 9:00 PM (19:00 - 21:00)', () => {
    const result = hasBookingConflict(facilityId, '2026-09-20', '19:00', '21:00', undefined, existingBookings);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingBooking?.id).toBe('booking-existing-1');
  });

  it('rejects overlapping time slots: 5:30 PM - 6:30 PM (17:30 - 18:30)', () => {
    const result = hasBookingConflict(facilityId, '2026-09-20', '17:30', '18:30', undefined, existingBookings);
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingBooking?.id).toBe('booking-existing-1');
  });

  it('rejects exact matching duplicate slot: 6:00 PM - 8:00 PM (18:00 - 20:00)', () => {
    const result = hasBookingConflict(facilityId, '2026-09-20', '18:00', '20:00', undefined, existingBookings);
    expect(result.hasConflict).toBe(true);
  });

  it('allows adjacent boundary slot before existing: 4:00 PM - 6:00 PM (16:00 - 18:00)', () => {
    const result = hasBookingConflict(facilityId, '2026-09-20', '16:00', '18:00', undefined, existingBookings);
    expect(result.hasConflict).toBe(false);
  });

  it('allows adjacent boundary slot after existing: 8:00 PM - 9:00 PM (20:00 - 21:00)', () => {
    const result = hasBookingConflict(facilityId, '2026-09-20', '20:00', '21:00', undefined, existingBookings);
    expect(result.hasConflict).toBe(false);
  });

  it('ignores self booking ID when editing the same booking', () => {
    const result = hasBookingConflict(
      facilityId,
      '2026-09-20',
      '18:00',
      '20:00',
      'booking-existing-1', // Exclude self
      existingBookings
    );
    expect(result.hasConflict).toBe(false);
  });

  it('allows booking on a different facility at the same time', () => {
    const result = hasBookingConflict(
      'f-net-2', // Different facility
      '2026-09-20',
      '18:00',
      '20:00',
      undefined,
      existingBookings
    );
    expect(result.hasConflict).toBe(false);
  });
});

describe('Feature 2: Edit & Reschedule Booking', () => {
  beforeEach(() => {
    initializeStorage(true);
  });

  it('successfully updates time, customer info, fee, and due balance while preserving ID', async () => {
    // 1. Create initial booking
    const created = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-10-15',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Original Name',
      customer_phone: '9876543210',
      total_amount: 2000,
      advance_paid: 500,
      payment_method: 'UPI',
    });

    const originalId = created.id;

    // 2. Edit & Reschedule
    const editPayload: EditBookingFormData = {
      booking_id: originalId,
      facility_id: 'f-1',
      date: '2026-10-16', // Rescheduled date
      start_time: '09:00', // Rescheduled start
      end_time: '11:00',   // Rescheduled end
      customer_name: 'Updated Name',
      customer_phone: '9876543210',
      team_name: 'Super Kings CC',
      total_amount: 2500,
      custom_pending_amount: 1200,
      pending_adjustment_reason: 'Rescheduled + floodlight fee',
      notes: 'Updated morning session',
    };

    const updated = await updateBooking(editPayload);

    expect(updated.id).toBe(originalId);
    expect(updated.total_amount).toBe(2500);
    expect(updated.custom_pending_amount).toBe(1200);
    expect(updated.pending_adjustment_reason).toBe('Rescheduled + floodlight fee');
    expect(updated.notes).toBe('Updated morning session');
    expect(updated.updated_at).toBeDefined();
  });

  it('allows force booking override with is_conflict_override = true', async () => {
    // Booking 1: 06:00 to 08:00
    const b1 = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-25',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Player One',
      customer_phone: '9111111111',
      total_amount: 2000,
      advance_paid: 0,
      payment_method: 'CASH',
    });

    // Booking 2 overlapping (07:00 to 09:00) with force override:
    const b2 = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-25',
      start_time: '07:00',
      end_time: '09:00',
      customer_name: 'Player Two',
      customer_phone: '9222222222',
      total_amount: 2000,
      advance_paid: 0,
      payment_method: 'CASH',
      is_conflict_override: true, // Force override
    });

    expect(b2.id).toBeDefined();
    expect(b2.is_conflict_override).toBe(true);
  });
});

describe('Feature 3: Search & Fast Filter Engine', () => {
  const mockBookings: Booking[] = [
    {
      id: 'b-search-1',
      facility_id: 'f-ground',
      customer_id: 'c-1',
      booking_date: '2026-09-20',
      start_time: '2026-09-20T06:00:00.000Z',
      end_time: '2026-09-20T08:00:00.000Z',
      total_amount: 3000,
      total_paid: 3000,
      pending_amount: 0,
      payment_status: 'FULLY_PAID',
      is_cancelled: false,
      created_at: '2026-09-01T00:00:00.000Z',
      customer: { id: 'c-1', name: 'Virat Kohli', phone: '9876543210', team_name: 'Royal Strikers' },
      facility: { id: 'f-ground', name: 'Main Ground', type: 'GROUND', hourly_rate: 1500, display_order: 1, is_active: true },
    },
    {
      id: 'b-search-2',
      facility_id: 'f-net-1',
      customer_id: 'c-2',
      booking_date: '2026-09-20',
      start_time: '2026-09-20T10:00:00.000Z',
      end_time: '2026-09-20T11:30:00.000Z',
      total_amount: 750,
      total_paid: 250,
      pending_amount: 500,
      payment_status: 'PARTIALLY_PAID',
      is_cancelled: false,
      created_at: '2026-09-01T00:00:00.000Z',
      customer: { id: 'c-2', name: 'MS Dhoni', phone: '9845000000', team_name: 'Super Kings' },
      facility: { id: 'f-net-1', name: 'Net 1', type: 'NET', hourly_rate: 500, display_order: 2, is_active: true },
    },
    {
      id: 'b-search-3',
      facility_id: 'f-ground',
      customer_id: 'c-3',
      booking_date: '2026-09-22',
      start_time: '2026-09-22T18:00:00.000Z',
      end_time: '2026-09-22T21:00:00.000Z',
      total_amount: 4500,
      total_paid: 0,
      pending_amount: 4500,
      payment_status: 'UNPAID',
      is_cancelled: true, // Cancelled
      created_at: '2026-09-01T00:00:00.000Z',
      customer: { id: 'c-3', name: 'Rohit Sharma', phone: '9711000000', team_name: 'Hitmen CC' },
      facility: { id: 'f-ground', name: 'Main Ground', type: 'GROUND', hourly_rate: 1500, display_order: 1, is_active: true },
    },
  ];

  it('searches by customer name', () => {
    const filters: BookingSearchFilters = {
      searchQuery: 'Virat',
      statusFilter: 'ALL',
      facilityId: 'ALL',
    };
    const results = filterBookings(mockBookings, filters);
    expect(results.length).toBe(1);
    expect(results[0].customer?.name).toBe('Virat Kohli');
  });

  it('searches by phone number substring', () => {
    const filters: BookingSearchFilters = {
      searchQuery: '984500',
      statusFilter: 'ALL',
      facilityId: 'ALL',
    };
    const results = filterBookings(mockBookings, filters);
    expect(results.length).toBe(1);
    expect(results[0].customer?.name).toBe('MS Dhoni');
  });

  it('filters by payment status: PENDING_PAYMENT / Due', () => {
    const filters: BookingSearchFilters = {
      searchQuery: '',
      statusFilter: 'PENDING_PAYMENT',
      facilityId: 'ALL',
    };
    const results = filterBookings(mockBookings, filters);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('b-search-2');
  });

  it('filters by facility ID', () => {
    const filters: BookingSearchFilters = {
      searchQuery: '',
      statusFilter: 'ALL',
      facilityId: 'f-net-1',
    };
    const results = filterBookings(mockBookings, filters);
    expect(results.length).toBe(1);
    expect(results[0].facility?.name).toBe('Net 1');
  });

  it('filters by cancelled status', () => {
    const filters: BookingSearchFilters = {
      searchQuery: '',
      statusFilter: 'CANCELLED',
      facilityId: 'ALL',
    };
    const results = filterBookings(mockBookings, filters);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('b-search-3');
    expect(results[0].is_cancelled).toBe(true);
  });
});
