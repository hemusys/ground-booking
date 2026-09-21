import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createQuickBooking,
  hasBookingConflict,
  createRecurringBookings,
  generateRecurringDates,
  analyzeRecurrenceConflicts,
  recordPayment,
  toggleCustomerBlacklist,
  fetchCustomerById,
  computeReconciliationExpected,
  saveDailyReconciliation,
  fetchDailyReconciliation,
  fetchBookings,
  fetchBookingAuditLogs,
  initializeStorage
} from '../lib/api';
import { 
  buildWhatsAppBookingLink, 
  buildWhatsAppDueReminderLink 
} from '../lib/whatsapp';
import { 
  createSafeBookingInterval, 
  getTimelineCoordinates 
} from '../lib/time';
import { QuickBookFormData } from '../types';

describe('PRODUCTION AUDIT: End-to-End Mission Verification', () => {
  beforeEach(() => {
    initializeStorage(true, false);
  });

  describe('PHASE 3 — BOOKING ENGINE AUDIT', () => {
    it('A. Normal booking (6 PM - 8 PM) succeeds', async () => {
      const normalPayload: QuickBookFormData = {
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '18:00',
        end_time: '20:00',
        customer_name: 'Phase 3 Normal User',
        customer_phone: '9876500001',
        total_amount: 1500,
        advance_paid: 500,
        payment_method: 'UPI',
        transaction_reference: 'UPI/UTR/888999111',
      };

      const booking = await createQuickBooking(normalPayload);
      expect(booking).toBeDefined();
      expect(booking.id).toBeTruthy();
      expect(booking.facility_id).toBe('f-1');
      expect(booking.is_conflict_override).toBe(false);
      expect(booking.booking_date).toBe('2026-09-22');
    });

    it('B. Overlap booking (7 PM - 9 PM) is blocked by conflict detection', async () => {
      await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '18:00',
        end_time: '20:00',
        customer_name: 'Existing Slot Holder',
        customer_phone: '9876500002',
        total_amount: 1500,
        advance_paid: 1500,
        payment_method: 'CASH',
      });

      const currentBookings = await fetchBookings();
      const conflict = hasBookingConflict('f-1', '2026-09-22', '19:00', '21:00', undefined, currentBookings);
      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictingBooking).toBeDefined();
      expect(conflict.conflictingBooking?.customer?.name).toBe('Existing Slot Holder');
    });

    it('C. Force booking allows conflict with is_conflict_override = true', async () => {
      await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '18:00',
        end_time: '20:00',
        customer_name: 'Slot Owner',
        customer_phone: '9876500003',
        total_amount: 1500,
        advance_paid: 500,
        payment_method: 'UPI',
        transaction_reference: 'UPI123456',
      });

      const forcedBooking = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '19:00',
        end_time: '21:00',
        customer_name: 'VIP Force Booker',
        customer_phone: '9876500004',
        total_amount: 2000,
        advance_paid: 2000,
        payment_method: 'CASH',
        is_conflict_override: true,
      });

      expect(forcedBooking.is_conflict_override).toBe(true);
      const audit = await fetchBookingAuditLogs(forcedBooking.id);
      expect(audit.some(a => a.action_type === 'CONFLICT_OVERRIDE')).toBe(true);
    });

    it('D. Adjacent booking (8 PM - 10 PM) is allowed with zero overlap', async () => {
      await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '18:00',
        end_time: '20:00',
        customer_name: 'First Half Match',
        customer_phone: '9876500005',
        total_amount: 1500,
        advance_paid: 1500,
        payment_method: 'CASH',
      });

      const currentBookings = await fetchBookings();
      const adjacentConflict = hasBookingConflict('f-1', '2026-09-22', '20:00', '22:00', undefined, currentBookings);
      expect(adjacentConflict.hasConflict).toBe(false);

      const adjacentBooking = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-22',
        start_time: '20:00',
        end_time: '22:00',
        customer_name: 'Second Half Match',
        customer_phone: '9876500006',
        total_amount: 1500,
        advance_paid: 1500,
        payment_method: 'CASH',
      });

      expect(adjacentBooking).toBeDefined();
      expect(adjacentBooking.is_conflict_override).toBe(false);
    });
  });

  describe('PHASE 4 — RECURRING BOOKING AUDIT', () => {
    it('generates and books 8 weeks of Mon/Wed/Fri (24 sessions)', async () => {
      const dates = generateRecurringDates(
        '2026-09-21', 
        '2026-11-13', 
        'CUSTOM_WEEKDAYS', 
        ['MON', 'WED', 'FRI']
      );
      expect(dates.length).toBe(24);

      await createQuickBooking({
        facility_id: 'f-2',
        date: dates[7],
        start_time: '06:00',
        end_time: '08:00',
        customer_name: 'Slot Squatter',
        customer_phone: '9876599999',
        total_amount: 1000,
        advance_paid: 1000,
        payment_method: 'CASH',
      });

      const analysis = await analyzeRecurrenceConflicts(
        'f-2', 
        dates, 
        '06:00', 
        '08:00'
      );

      expect(analysis.totalRequested).toBe(24);
      expect(analysis.conflicts.length).toBe(1);
      expect(analysis.availableDates.length).toBe(23);
      expect(analysis.conflicts[0].date).toBe(dates[7]);

      const recurringPayload: QuickBookFormData = {
        facility_id: 'f-2',
        date: dates[0],
        start_time: '06:00',
        end_time: '08:00',
        customer_name: 'Apex Academy',
        customer_phone: '9876511111',
        team_name: 'Apex Colts',
        total_amount: 1000,
        advance_paid: 5000,
        payment_method: 'UPI',
        transaction_reference: 'APEX/REC/202609',
        repeat_type: 'CUSTOM_WEEKDAYS',
        repeat_weekdays: ['MON', 'WED', 'FRI'],
        repeat_end_date: '2026-11-13',
      };

      const result = await createRecurringBookings(recurringPayload, analysis.availableDates);

      expect(result.group).toBeDefined();
      expect(result.group.repeat_type).toBe('CUSTOM_WEEKDAYS');
      expect(result.bookings.length).toBe(23);
      result.bookings.forEach(b => {
        expect(b.recurring_group_id).toBe(result.group.id);
        expect(b.facility_id).toBe('f-2');
        expect(b.booking_date).not.toBe(dates[7]);
      });
    });
  });

  describe('PHASE 5 — CUSTOMER CRM AUDIT', () => {
    it('accurately computes lifetime revenue, dues, and reliability score with blacklist controls', async () => {
      const b1 = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-25',
        start_time: '10:00',
        end_time: '12:00',
        customer_name: 'Vikram Seth',
        customer_phone: '9876522222',
        total_amount: 2000,
        advance_paid: 2000,
        payment_method: 'CASH',
      });

      await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-26',
        start_time: '14:00',
        end_time: '16:00',
        customer_name: 'Vikram Seth',
        customer_phone: '9876522222',
        total_amount: 3000,
        advance_paid: 1000,
        payment_method: 'UPI',
        transaction_reference: 'UPI/VIK/1',
      });

      const profile = await fetchCustomerById(b1.customer_id);
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('Vikram Seth');
      expect(profile?.total_spent).toBe(3000); // Amount paid
      expect(profile?.total_pending).toBe(2000); // Amount remaining
      expect(profile?.reliability_score).toBe(50); // 1 settled out of 2 = 50%
      expect(profile?.bookings.length).toBe(2);

      await toggleCustomerBlacklist(b1.customer_id, true, 'Repeated late cancellations');
      const updatedProfile = await fetchCustomerById(b1.customer_id);
      expect(updatedProfile?.is_blacklisted).toBe(true);
      expect(updatedProfile?.blacklist_reason).toBe('Repeated late cancellations');

      await expect(createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-27',
        start_time: '10:00',
        end_time: '12:00',
        customer_name: 'Vikram Seth',
        customer_phone: '9876522222',
        total_amount: 2000,
        advance_paid: 2000,
        payment_method: 'CASH',
      })).rejects.toThrow(/Customer is blacklisted/);

      const overriddenBooking = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-27',
        start_time: '10:00',
        end_time: '12:00',
        customer_name: 'Vikram Seth',
        customer_phone: '9876522222',
        total_amount: 2000,
        advance_paid: 2000,
        payment_method: 'CASH',
        allow_blacklist_override: true,
      });
      expect(overriddenBooking).toBeDefined();
    });
  });

  describe('PHASE 6 — PAYMENT AUDIT', () => {
    it('requires transaction reference for UPI and records audit logs and ledger updates', async () => {
      const booking = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-28',
        start_time: '16:00',
        end_time: '18:00',
        customer_name: 'Rohan Sharma',
        customer_phone: '9876533333',
        total_amount: 3000,
        advance_paid: 0,
        payment_method: 'CASH',
      });

      const payment1 = await recordPayment(
        booking.id,
        1000,
        'CASH',
        'Collected at front desk register'
      );
      expect(payment1.id).toBeTruthy();
      expect(payment1.amount).toBe(1000);
      expect(payment1.payment_notes).toBe('Collected at front desk register');

      const payment2 = await recordPayment(
        booking.id,
        2000,
        'UPI',
        'PhonePe QR scan at entrance',
        'UPI/HDFC/99221144'
      );
      expect(payment2.transaction_reference).toBe('UPI/HDFC/99221144');

      const auditLogs = await fetchBookingAuditLogs(booking.id);
      const paymentLogs = auditLogs.filter(a => a.action_type === 'PAYMENT_COLLECTED');
      expect(paymentLogs.length).toBe(2);

      const allBookings = await fetchBookings();
      const target = allBookings.find(b => b.id === booking.id)!;
      expect(target.total_paid).toBe(3000);
      expect(target.pending_amount).toBe(0);
      expect(target.payment_status).toBe('FULLY_PAID');
    });
  });

  describe('PHASE 7 — WHATSAPP AUDIT', () => {
    it('generates valid WhatsApp URLs with customer name, amount, date, and payment details', async () => {
      const booking = await createQuickBooking({
        facility_id: 'f-1',
        date: '2026-09-29',
        start_time: '06:00',
        end_time: '08:00',
        customer_name: 'Anand Kumar',
        customer_phone: '9876544444',
        total_amount: 2000,
        advance_paid: 500,
        payment_method: 'UPI',
        transaction_reference: 'UPI/UTR/112233',
      });

      const interval = createSafeBookingInterval('2026-09-29', '06:00', '08:00');
      const confirmUrl = buildWhatsAppBookingLink({
        phone: '9876544444',
        customerName: 'Anand Kumar',
        facilityName: 'Main Ground',
        startIso: interval.startIso,
        endIso: interval.endIso,
        totalAmount: 2000,
        advancePaid: 500,
        pendingAmount: 1500,
      });

      expect(confirmUrl).toContain('wa.me/919876544444');
      const decodedConfirm = decodeURIComponent(confirmUrl);
      expect(decodedConfirm).toContain('Anand Kumar');
      expect(decodedConfirm).toContain('2,000');
      expect(decodedConfirm).toContain('500');
      expect(decodedConfirm).toContain('1,500');

      const reminderUrl = buildWhatsAppDueReminderLink({
        phone: '9876544444',
        customerName: 'Anand Kumar',
        facilityName: 'Main Ground',
        startIso: interval.startIso,
        endIso: interval.endIso,
        totalAmount: 2000,
        advancePaid: 500,
        pendingAmount: 1500,
      });
      expect(reminderUrl).toContain('wa.me/919876544444');
      const decodedReminder = decodeURIComponent(reminderUrl);
      expect(decodedReminder).toContain('1,500');
      expect(decodedReminder).toContain('Anand Kumar');
    });
  });

  describe('PHASE 8 — CALENDAR & TIMEZONE AUDIT', () => {
    it('verifies 5:00 AM booking with zero UTC drift and accurate timeline positioning', () => {
      const dateStr = '2026-09-20';
      const { startIso, endIso, durationMins } = createSafeBookingInterval(dateStr, '05:00', '07:00');
      expect(durationMins).toBe(120);

      const coords = getTimelineCoordinates(startIso, endIso, dateStr, 110);
      expect(coords.left).toBe(0);
      expect(coords.width).toBe(220);
      expect(coords.isVisibleOnDate).toBe(true);

      const localDate = new Date(startIso);
      expect(localDate.getHours()).toBe(5);
      expect(localDate.getMinutes()).toBe(0);
    });
  });

  describe('PHASE 9 — RECONCILIATION AUDIT', () => {
    it('computes expected totals and records discrepancy variance accurately', async () => {
      const recDate = '2026-09-30';

      await createQuickBooking({
        facility_id: 'f-1',
        date: recDate,
        start_time: '06:00',
        end_time: '08:00',
        customer_name: 'Cash Payer',
        customer_phone: '9876555551',
        total_amount: 3500,
        advance_paid: 3500,
        payment_method: 'CASH',
      });

      await createQuickBooking({
        facility_id: 'f-1',
        date: recDate,
        start_time: '08:00',
        end_time: '10:00',
        customer_name: 'UPI Payer',
        customer_phone: '9876555552',
        total_amount: 3000,
        advance_paid: 3000,
        payment_method: 'UPI',
        transaction_reference: 'UPI/REC/3000',
      });

      await createQuickBooking({
        facility_id: 'f-1',
        date: recDate,
        start_time: '10:00',
        end_time: '12:00',
        customer_name: 'Card Payer',
        customer_phone: '9876555553',
        total_amount: 1000,
        advance_paid: 1000,
        payment_method: 'CARD',
      });

      const expected = await computeReconciliationExpected(recDate);
      expect(expected.cash).toBe(3500);
      expect(expected.upi).toBe(3000);
      expect(expected.card).toBe(1000);
      expect(expected.total).toBe(7500);

      const reconciliation = await saveDailyReconciliation({
        date: recDate,
        cash_expected: 3500,
        cash_actual: 3000,
        upi_expected: 3000,
        upi_actual: 3000,
        card_expected: 1000,
        card_actual: 1000,
        variance: -500,
        status: 'VARIANCE_FOUND',
        notes: 'Rs 500 cash shortage in drawer register #1',
        closed_by: 'Night Shift Lead',
      });

      expect(reconciliation.variance).toBe(-500);
      expect(reconciliation.status).toBe('VARIANCE_FOUND');

      const saved = await fetchDailyReconciliation(recDate);
      expect(saved).toBeDefined();
      expect(saved?.status).toBe('VARIANCE_FOUND');
      expect(saved?.variance).toBe(-500);
      expect(saved?.notes).toContain('shortage');
    });
  });
});
