import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchBrokers,
  saveBroker,
  toggleBrokerStatus,
  createQuickBooking,
  updateBooking,
  getMaskedBookingsForRole,
  fetchBrokerStats,
  fetchBrokerOperationalReport,
  fetchBookings,
  initializeStorage,
} from '../lib/api';
import { QuickBookFormData, EditBookingFormData, Booking } from '../types';

describe('Broker Management & Match Booking System', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('1. Initializes default brokers and generates sequential BRK-00X codes', async () => {
    const brokers = await fetchBrokers();
    expect(brokers.length).toBeGreaterThanOrEqual(3);
    expect(brokers[0].code).toBe('BRK-001');
    expect(brokers[1].code).toBe('BRK-002');
    expect(brokers[2].code).toBe('BRK-003');

    // Create a 4th broker and verify auto-generated code
    const newBroker = await saveBroker({
      name: 'Vikas Cricket Academy',
      phone: '9888877777',
      notes: 'Weekend tournament organizer',
      is_active: true,
    });

    expect(newBroker.code).toBe('BRK-004');
    expect(newBroker.name).toBe('Vikas Cricket Academy');

    const updatedBrokers = await fetchBrokers();
    expect(updatedBrokers.length).toBe(4);
    expect(updatedBrokers.find((b) => b.code === 'BRK-004')).toBeDefined();
  });

  it('2. Toggles broker active/disabled status', async () => {
    const brokers = await fetchBrokers();
    const firstBroker = brokers[0];
    expect(firstBroker.is_active).toBe(true);

    const toggled = await toggleBrokerStatus(firstBroker.id);
    expect(toggled?.is_active).toBe(false);

    const reloaded = await fetchBrokers();
    expect(reloaded.find((b) => b.id === firstBroker.id)?.is_active).toBe(false);
  });

  it('3. Creates Team A vs Team B booking with Broker attribution', async () => {
    const brokers = await fetchBrokers();
    const broker = brokers[0]; // BRK-001

    const bookingPayload: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-10-15',
      start_time: '14:00',
      end_time: '16:00',
      customer_name: 'Rahul Sharma',
      customer_phone: '9876543210',
      team_name: 'Warriors XI',
      team_a_name: 'Warriors XI',
      team_b_name: 'Super Strikers',
      booking_source: 'BROKER',
      broker_id: broker.id,
      total_amount: 3000,
      advance_paid: 1000,
      payment_method: 'UPI',
    };

    const booking = await createQuickBooking(bookingPayload);
    expect(booking).toBeDefined();
    expect(booking.team_a_name).toBe('Warriors XI');
    expect(booking.team_b_name).toBe('Super Strikers');
    expect(booking.booking_source).toBe('BROKER');
    expect(booking.broker_id).toBe(broker.id);
    expect(booking.broker?.code).toBe('BRK-001');
    expect(booking.pending_amount).toBe(2000);
  });

  it('4. Applies Special Discount (Percentage & Flat Fixed) with live fee adjustments', async () => {
    // 10% Percentage Discount on ₹4000 = ₹400 off -> Total ₹3600
    const percentBookingPayload: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-10-16',
      start_time: '08:00',
      end_time: '10:00',
      customer_name: 'Vikram Mehta',
      customer_phone: '9123456789',
      team_name: 'Blasters CC',
      team_a_name: 'Blasters CC',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      discount_amount: 400,
      discount_reason: 'REGULAR_CUSTOMER',
      total_amount: 3600,
      advance_paid: 3600,
      payment_method: 'CASH',
    };

    const percentBooking = await createQuickBooking(percentBookingPayload);
    expect(percentBooking).toBeDefined();
    expect(percentBooking.discount_type).toBe('PERCENTAGE');
    expect(percentBooking.discount_amount).toBe(400);
    expect(percentBooking.total_amount).toBe(3600);
    expect(percentBooking.payment_status).toBe('FULLY_PAID');
    expect(percentBooking.pending_amount).toBe(0);

    // Fixed Flat Discount of ₹500
    const fixedBookingPayload: QuickBookFormData = {
      facility_id: 'f-2',
      date: '2026-10-17',
      start_time: '16:00',
      end_time: '18:00',
      customer_name: 'Arun Kumar',
      customer_phone: '9988776655',
      team_name: 'Kings XI',
      discount_type: 'FIXED',
      discount_value: 500,
      discount_amount: 500,
      discount_reason: 'BROKER_OFFER',
      total_amount: 2500,
      advance_paid: 1000,
      payment_method: 'UPI',
    };

    const fixedBooking = await createQuickBooking(fixedBookingPayload);
    expect(fixedBooking).toBeDefined();
    expect(fixedBooking.discount_type).toBe('FIXED');
    expect(fixedBooking.discount_amount).toBe(500);
    expect(fixedBooking.total_amount).toBe(2500);
    expect(fixedBooking.pending_amount).toBe(1500);
  });

  it('5. Enforces Role Privacy Masking for Calendar and Timeline Views', async () => {
    const brokers = await fetchBrokers();
    const broker1 = brokers[0]; // BRK-001
    const broker2 = brokers[1]; // BRK-002

    // Broker 1 booking
    const b1 = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-10-20',
      start_time: '09:00',
      end_time: '11:00',
      customer_name: 'Captain Virat',
      customer_phone: '9876500001',
      team_name: 'Royal Challengers',
      team_a_name: 'Royal Challengers',
      team_b_name: 'Super Kings',
      booking_source: 'BROKER',
      broker_id: broker1.id,
      total_amount: 3000,
      advance_paid: 1000,
      payment_method: 'UPI',
    });

    // Scenario A: Owner views booking -> Full transparency
    const ownerView = getMaskedBookingsForRole([b1], 'OWNER', null);
    expect(ownerView[0].is_masked).toBe(false);
    expect(ownerView[0].customer?.name).toBe('Captain Virat');
    expect(ownerView[0].customer?.phone).toBe('9876500001');
    expect(ownerView[0].total_amount).toBe(3000);
    expect(ownerView[0].pending_amount).toBe(2000);
    expect(ownerView[0].team_a_name).toBe('Royal Challengers');
    expect(ownerView[0].team_b_name).toBe('Super Kings');

    // Scenario B: Broker 1 views own booking -> Full match details visible
    const broker1View = getMaskedBookingsForRole([b1], 'BROKER', broker1.id);
    expect(broker1View[0].is_masked).toBe(false);
    expect(broker1View[0].customer?.name).toBe('Captain Virat');
    expect(broker1View[0].team_b_name).toBe('Super Kings');

    // Scenario C: Broker 2 views Broker 1 booking -> STRICT PRIVACY MASKING
    const broker2View = getMaskedBookingsForRole([b1], 'BROKER', broker2.id);
    expect(broker2View[0].is_masked).toBe(true);
    expect(broker2View[0].customer).toBeUndefined();
    expect(broker2View[0].customer_phone).toBeUndefined();
    expect(broker2View[0].team_a_name).toBe('BOOKED');
    expect(broker2View[0].team_b_name).toBeNull();
    expect(broker2View[0].notes).toBeNull();
    expect(broker2View[0].total_amount).toBe(0);
    expect(broker2View[0].pending_amount).toBe(0);
    expect(broker2View[0].total_paid).toBe(0);
    expect(broker2View[0].payments).toEqual([]);
    expect(broker2View[0].discount_amount).toBe(0);
  });

  it('6. Computes strictly operational stats and reports without financial metric exposure', async () => {
    const brokers = await fetchBrokers();
    const broker1 = brokers[0];

    // Create 2 bookings for broker1 (2 hours each = 4 hours)
    await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-10-22',
      start_time: '10:00',
      end_time: '12:00',
      customer_name: 'Player 1',
      customer_phone: '9999911111',
      booking_source: 'BROKER',
      broker_id: broker1.id,
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'CASH',
    });

    await createQuickBooking({
      facility_id: 'f-2',
      date: '2026-10-23',
      start_time: '14:00',
      end_time: '16:00',
      customer_name: 'Player 2',
      customer_phone: '9999922222',
      booking_source: 'BROKER',
      broker_id: broker1.id,
      total_amount: 4000,
      advance_paid: 0,
      payment_method: 'CASH',
    });

    const stats = await fetchBrokerStats(broker1.id);
    expect(stats.total_bookings).toBe(2);
    expect(stats.total_hours_booked).toBe(4);
    expect(stats).not.toHaveProperty('total_revenue');
    expect(stats).not.toHaveProperty('total_commission');

    const report = await fetchBrokerOperationalReport();
    const broker1Report = report.find((r) => r.broker_id === broker1.id);
    expect(broker1Report).toBeDefined();
    expect(broker1Report?.total_bookings).toBe(2);
    expect(broker1Report?.total_hours_booked).toBe(4);
    expect(broker1Report?.broker_code).toBe('BRK-001');
    expect(broker1Report).not.toHaveProperty('revenue');
  });

  it('7. Supports editing match details, opponent teams, and discounts', async () => {
    const booking = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-10-25',
      start_time: '18:00',
      end_time: '20:00',
      customer_name: 'Original Contact',
      customer_phone: '9876543210',
      team_name: 'Original Team',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'CASH',
    });

    const editPayload: EditBookingFormData = {
      booking_id: booking.id,
      facility_id: 'f-1',
      date: '2026-10-25',
      start_time: '18:00',
      end_time: '20:00',
      customer_name: 'Updated Contact',
      customer_phone: '9876543210',
      team_name: 'Titans XI',
      team_a_name: 'Titans XI',
      team_b_name: 'Gladiators CC',
      booking_source: 'ONLINE',
      discount_type: 'PERCENTAGE',
      discount_value: 15,
      discount_amount: 450,
      discount_reason: 'TOURNAMENT',
      total_amount: 2550,
      custom_pending_amount: 2550,
    };

    const updated = await updateBooking(editPayload);
    expect(updated).toBeDefined();
    expect(updated.team_a_name).toBe('Titans XI');
    expect(updated.team_b_name).toBe('Gladiators CC');
    expect(updated.booking_source).toBe('ONLINE');
    expect(updated.discount_amount).toBe(450);
    expect(updated.total_amount).toBe(2550);
  });
});
