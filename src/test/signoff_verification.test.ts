import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeStorage,
  fetchBookings,
  createQuickBooking,
  getMaskedBookingsForRole,
  fetchBrokers,
} from '../lib/api';
import { QuickBookFormData } from '../types';

describe('Sign-Off Verification Test Suite (Real Runtime Checks)', () => {
  beforeEach(() => {
    initializeStorage(true, true);
  });

  it('Executes all 6 Sign-Off verification steps with exact user specifications', async () => {
    const brokers = await fetchBrokers();
    const broker1 = brokers.find((b) => b.code === 'BRK-001') || brokers[0];
    const broker2 = brokers.find((b) => b.code === 'BRK-002') || brokers[1];

    expect(broker1.code).toBe('BRK-001');
    expect(broker2.code).toBe('BRK-002');

    // 1. Create a new booking:
    // Team A = Chennai Kings
    // Team B = Super Strikers
    // Broker = BRK-001
    // Discount = 10%
    const payload: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-10-15',
      start_time: '16:00',
      end_time: '18:00',
      customer_name: 'MS Dhoni',
      customer_phone: '9876543299',
      team_name: 'Chennai Kings',
      team_a_name: 'Chennai Kings',
      team_b_name: 'Super Strikers',
      booking_source: 'BROKER',
      broker_id: broker1.id,
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      discount_amount: 300,
      discount_reason: 'REGULAR_CUSTOMER',
      total_amount: 2700,
      advance_paid: 1000,
      payment_method: 'UPI',
      notes: 'Confidential strategy match notes',
    };

    const created = await createQuickBooking(payload);
    expect(created.id).toBeDefined();

    // 2. Refresh the application (Simulated by fresh storage read)
    const reloadedBookings = await fetchBookings();
    const persisted = reloadedBookings.find((b) => b.id === created.id);

    // 3. Verify Persistence:
    expect(persisted).toBeDefined();
    // Team A persists
    expect(persisted?.team_a_name).toBe('Chennai Kings');
    // Team B persists
    expect(persisted?.team_b_name).toBe('Super Strikers');
    // Broker assignment persists
    expect(persisted?.broker_id).toBe(broker1.id);
    expect(persisted?.broker?.code).toBe('BRK-001');
    // Discount persists
    expect(persisted?.discount_type).toBe('PERCENTAGE');
    expect(persisted?.discount_value).toBe(10);
    expect(persisted?.discount_amount).toBe(300);
    expect(persisted?.discount_reason).toBe('REGULAR_CUSTOMER');
    expect(persisted?.total_amount).toBe(2700);

    // 4. Switch to BRK-002 and verify the same booking displays only as: BOOKED
    const broker2View = getMaskedBookingsForRole([persisted!], 'BROKER', broker2.id);
    expect(broker2View[0].is_masked).toBe(true);
    expect(broker2View[0].team_a_name).toBe('BOOKED');
    expect(broker2View[0].team_b_name).toBeNull();

    // 5. Confirm no customer names, phone numbers, notes, amounts, or discount details are visible to BRK-002:
    expect(broker2View[0].customer).toBeUndefined();
    expect(broker2View[0].customer_phone).toBeUndefined();
    expect(broker2View[0].notes).toBeNull();
    expect(broker2View[0].total_amount).toBe(0);
    expect(broker2View[0].pending_amount).toBe(0);
    expect(broker2View[0].total_paid).toBe(0);
    expect(broker2View[0].payments).toEqual([]);
    expect(broker2View[0].discount_amount).toBe(0);
    expect(broker2View[0].discount_type).toBe('NONE');
    expect(broker2View[0].discount_value).toBe(0);
    expect(broker2View[0].discount_reason).toBeNull();

    // 6. Confirm storage contains the new fields and that older seeded bookings still render correctly:
    const allBookings = await fetchBookings();
    const persistedBooking = allBookings.find(b => b.id === created.id);
    expect(persistedBooking).toBeDefined();
    expect(persistedBooking?.team_a_name).toBe('Chennai Kings');
    expect(persistedBooking?.team_b_name).toBe('Super Strikers');
    expect(persistedBooking?.discount_reason).toBe('REGULAR_CUSTOMER');
    expect(persistedBooking?.discount_amount).toBe(300);

    const olderBookings = reloadedBookings.filter((b) => b.id !== created.id);
    expect(olderBookings.length).toBeGreaterThan(0);
    olderBookings.forEach((oldBooking) => {
      expect(oldBooking.id).toBeDefined();
      expect(oldBooking.facility_id).toBeDefined();
      expect(oldBooking.booking_date).toBeDefined();
      expect(typeof oldBooking.total_amount).toBe('number');
    });
  });
});
