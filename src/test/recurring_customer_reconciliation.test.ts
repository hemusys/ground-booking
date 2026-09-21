import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateRecurringDates,
  analyzeRecurrenceConflicts,
  createRecurringBookings,
  cancelBookingSeries,
  updateBooking,
  createQuickBooking,
  fetchBookings,
  toggleCustomerBlacklist,
  fetchCustomerById,
  fetchCustomerSummaries,
  computeReconciliationExpected,
  saveDailyReconciliation,
  fetchDailyReconciliation,
  fetchReconciliationHistory,
  computeReconciliationMetrics,
  initializeStorage
} from '../lib/api';
import { QuickBookFormData, EditBookingFormData, Weekday } from '../types';
import { createSafeBookingInterval } from '../lib/time';

describe('PRIORITY 1 — Recurring Academy Bookings', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('generates weekly recurring dates accurately for 4 weeks', () => {
    // 2026-09-21 is a Monday
    const dates = generateRecurringDates('2026-09-21', '2026-10-12', 'WEEKLY');
    expect(dates.length).toBe(4);
    expect(dates).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
  });

  it('generates custom weekday recurring dates (Mon, Wed, Fri)', () => {
    // From 2026-09-21 (Mon) to 2026-09-27 (Sun) -> Mon(21), Wed(23), Fri(25)
    const weekdays: Weekday[] = ['MON', 'WED', 'FRI'];
    const dates = generateRecurringDates('2026-09-21', '2026-09-27', 'CUSTOM_WEEKDAYS', weekdays);
    expect(dates.length).toBe(3);
    expect(dates).toEqual(['2026-09-21', '2026-09-23', '2026-09-25']);
  });

  it('analyzes recurrence conflicts across multiple requested dates', async () => {
    // Seed an existing booking on 2026-09-28 from 06:00 to 08:00
    await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-28',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Existing Match Slot',
      customer_phone: '9876541111',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    });

    // Request 4 weekly sessions on Mondays 06:00 - 08:00
    const requestedDates = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
    const analysis = await analyzeRecurrenceConflicts('f-1', requestedDates, '06:00', '08:00');

    expect(analysis.totalRequested).toBe(4);
    expect(analysis.availableDates.length).toBe(3);
    expect(analysis.availableDates).toEqual(['2026-09-21', '2026-10-05', '2026-10-12']);
    expect(analysis.conflicts.length).toBe(1);
    expect(analysis.conflicts[0].date).toBe('2026-09-28');
  });

  it('creates recurring academy series linked with recurring_group_id', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Cricket Stars Academy',
      customer_phone: '9876542222',
      total_amount: 3000,
      advance_paid: 1000,
      payment_method: 'UPI',
      repeat_type: 'WEEKLY',
      repeat_end_date: '2026-10-05', // 3 Mondays: 21 Sep, 28 Sep, 05 Oct
      recurring_group_name: 'U16 Morning Batch',
    };

    const result = await createRecurringBookings(formData);
    expect(result.createdCount).toBe(3);
    expect(result.group.name).toBe('U16 Morning Batch');

    const allBookings = await fetchBookings();
    const groupBookings = allBookings.filter(b => b.recurring_group_id === result.group.id);
    expect(groupBookings.length).toBe(3);

    // Only first booking received the advance payment
    expect(groupBookings[0].total_paid).toBe(1000);
    expect(groupBookings[1].total_paid).toBe(0);
  });

  it('cancels all future bookings in a recurring series', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-2',
      date: '2026-09-21',
      start_time: '07:00',
      end_time: '08:30',
      customer_name: 'Series Cancel Test',
      customer_phone: '9876543333',
      total_amount: 750,
      advance_paid: 0,
      payment_method: 'CASH',
      repeat_type: 'WEEKLY',
      repeat_end_date: '2026-10-12', // 4 sessions
    };

    const result = await createRecurringBookings(formData);
    expect(result.createdCount).toBe(4);

    // Cancel starting from 2nd session (2026-09-28)
    const secondBooking = result.bookings[1];
    const cancelRes = await cancelBookingSeries(secondBooking.id, 'FUTURE_SERIES');
    expect(cancelRes.cancelledCount).toBe(3); // 28 Sep, 05 Oct, 12 Oct cancelled

    const activeBookings = await fetchBookings();
    const activeSeriesBookings = activeBookings.filter(b => b.recurring_group_id === result.group.id);
    expect(activeSeriesBookings.length).toBe(1); // Only 1st remains active
    expect(activeSeriesBookings[0].booking_date).toBe('2026-09-21');
  });

  it('updates all future sessions in series upon rescheduling', async () => {
    const formData: QuickBookFormData = {
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '06:00',
      end_time: '08:00',
      customer_name: 'Series Reschedule Test',
      customer_phone: '9876544444',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
      repeat_type: 'WEEKLY',
      repeat_end_date: '2026-10-05', // 3 sessions
    };

    const result = await createRecurringBookings(formData);

    // Reschedule time to 06:30 - 08:30 for all future sessions
    const editPayload: EditBookingFormData = {
      booking_id: result.bookings[0].id,
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '06:30',
      end_time: '08:30',
      customer_name: 'Series Reschedule Test',
      customer_phone: '9876544444',
      total_amount: 3000,
      edit_series_mode: 'FUTURE_SERIES',
    };

    await updateBooking(editPayload);

    const all = await fetchBookings();
    const updatedGroup = all.filter(b => b.recurring_group_id === result.group.id);
    expect(updatedGroup.length).toBe(3);
    updatedGroup.forEach(b => {
      const expected = createSafeBookingInterval(b.booking_date, '06:30', '08:30');
      expect(b.start_time).toBe(expected.startIso);
      expect(b.end_time).toBe(expected.endIso);
    });
  });
});

describe('PRIORITY 3 — Customer Profile, Lifetime Stats & Blacklist', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('calculates lifetime customer metrics and reliability scores', async () => {
    const summaries = await fetchCustomerSummaries();
    expect(summaries.length).toBeGreaterThan(0);
    const topCustomer = summaries[0];

    expect(typeof topCustomer.booking_count).toBe('number');
    expect(typeof topCustomer.total_spent).toBe('number');
    expect(typeof topCustomer.total_pending).toBe('number');
    expect(typeof topCustomer.reliability_score).toBe('number');
    expect(topCustomer.reliability_score).toBeGreaterThanOrEqual(0);
    expect(topCustomer.reliability_score).toBeLessThanOrEqual(100);
  });

  it('manages blacklist status and blocks booking without manager override', async () => {
    // 1. Create customer
    const b = await createQuickBooking({
      facility_id: 'f-1',
      date: '2026-09-21',
      start_time: '10:00',
      end_time: '12:00',
      customer_name: 'Blacklist Candidate',
      customer_phone: '9876555555',
      total_amount: 3000,
      advance_paid: 0,
      payment_method: 'UPI',
    });

    // 2. Blacklist customer
    await toggleCustomerBlacklist(b.customer_id, true, 'Defaulted on floodlight tournament fees');

    const customerSummary = await fetchCustomerById(b.customer_id);
    expect(customerSummary?.is_blacklisted).toBe(true);
    expect(customerSummary?.blacklist_reason).toBe('Defaulted on floodlight tournament fees');

    // 3. Attempting new booking without override fails
    await expect(
      createQuickBooking({
        facility_id: 'f-2',
        date: '2026-09-22',
        start_time: '10:00',
        end_time: '11:00',
        customer_name: 'Blacklist Candidate',
        customer_phone: '9876555555',
        total_amount: 500,
        advance_paid: 0,
        payment_method: 'UPI',
        allow_blacklist_override: false,
      })
    ).rejects.toThrow('Customer is blacklisted');

    // 4. Booking with allow_blacklist_override = true succeeds
    const overriddenBooking = await createQuickBooking({
      facility_id: 'f-2',
      date: '2026-09-22',
      start_time: '10:00',
      end_time: '11:00',
      customer_name: 'Blacklist Candidate',
      customer_phone: '9876555555',
      total_amount: 500,
      advance_paid: 500,
      payment_method: 'UPI',
      allow_blacklist_override: true,
    });

    expect(overriddenBooking).toBeDefined();
  });
});

describe('PRIORITY 5 — End of Day Reconciliation', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  it('computes expected cash, UPI, and card totals for a given date', async () => {
    const exp = await computeReconciliationExpected('2026-09-20');
    expect(typeof exp.cash).toBe('number');
    expect(typeof exp.upi).toBe('number');
    expect(typeof exp.card).toBe('number');
    expect(exp.total).toBe(exp.cash + exp.upi + exp.card);
  });

  it('saves daily reconciliation and determines status based on variance', async () => {
    // 1. Save balanced closing (0 variance)
    const balanced = await saveDailyReconciliation({
      date: '2026-09-20',
      cash_expected: 1000,
      cash_actual: 1000,
      upi_expected: 5000,
      upi_actual: 5000,
      card_expected: 0,
      card_actual: 0,
      variance: 0,
      status: 'CLOSED',
      notes: 'Even drawer count',
      closed_by: 'Ground Admin',
    });

    expect(balanced.status).toBe('CLOSED');
    expect(balanced.variance).toBe(0);

    const fetched = await fetchDailyReconciliation('2026-09-20');
    expect(fetched?.notes).toBe('Even drawer count');

    // 2. Save mismatch closing (Variance found)
    const mismatch = await saveDailyReconciliation({
      date: '2026-09-21',
      cash_expected: 2000,
      cash_actual: 1500, // ₹500 shortage
      upi_expected: 4000,
      upi_actual: 4000,
      card_expected: 0,
      card_actual: 0,
      variance: -500,
      status: 'VARIANCE_FOUND',
      notes: '₹500 cash shortage in register float',
      closed_by: 'Night Shift Lead',
    });

    expect(mismatch.status).toBe('VARIANCE_FOUND');
    expect(mismatch.variance).toBe(-500);

    // 3. Compute audit report metrics across history
    const history = await fetchReconciliationHistory();
    expect(history.length).toBe(2);

    const metrics = computeReconciliationMetrics(history);
    expect(metrics.totalDaysClosed).toBe(2);
    expect(metrics.daysWithMismatch).toBe(1);
    expect(metrics.totalVariance).toBe(-500);
  });
});
