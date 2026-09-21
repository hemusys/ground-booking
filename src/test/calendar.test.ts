import { describe, it, expect } from 'vitest';
import {
  getDayOccupancyStatus,
  generateMonthCalendar,
  computeDayScheduleForFacility,
} from '../lib/calendar';
import { Booking, Facility } from '../types';
import { parseISO } from 'date-fns';

import { createSafeBookingInterval } from '../lib/time';

describe('Calendar Module & Schedule Calculations', () => {
  const testFacility: Facility = {
    id: 'f-ground',
    name: 'Main Ground',
    type: 'GROUND',
    hourly_rate: 1500,
    display_order: 1,
    is_active: true,
  };

  const { startIso: b1Start, endIso: b1End } = createSafeBookingInterval('2026-09-20', '06:00', '10:00');
  const { startIso: b2Start, endIso: b2End } = createSafeBookingInterval('2026-09-20', '16:00', '20:00');

  const sampleBookings: Booking[] = [
    {
      id: 'b-1',
      facility_id: 'f-ground',
      customer_id: 'c-1',
      booking_date: '2026-09-20',
      start_time: b1Start,
      end_time: b1End,
      total_amount: 6000,
      total_paid: 6000,
      pending_amount: 0,
      payment_status: 'FULLY_PAID',
      is_cancelled: false,
      created_at: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'b-2',
      facility_id: 'f-ground',
      customer_id: 'c-2',
      booking_date: '2026-09-20',
      start_time: b2Start,
      end_time: b2End,
      total_amount: 6000,
      total_paid: 2000,
      pending_amount: 4000,
      payment_status: 'PARTIALLY_PAID',
      is_cancelled: false,
      created_at: '2026-09-01T00:00:00.000Z',
    },
  ];

  it('1. Correctly calculates occupancy status and color codes', () => {
    expect(getDayOccupancyStatus(0)).toBe('EMPTY');
    expect(getDayOccupancyStatus(1)).toBe('BOOKINGS_EXIST'); // Green
    expect(getDayOccupancyStatus(2)).toBe('BOOKINGS_EXIST'); // Green
    expect(getDayOccupancyStatus(3)).toBe('PARTIALLY_BOOKED'); // Yellow
    expect(getDayOccupancyStatus(4)).toBe('PARTIALLY_BOOKED'); // Yellow
    expect(getDayOccupancyStatus(5)).toBe('FULLY_BOOKED'); // Red
    expect(getDayOccupancyStatus(8)).toBe('FULLY_BOOKED'); // Red
  });

  it('2. Generates monthly calendar matrix with correct booking counts and revenue', () => {
    const targetMonth = parseISO('2026-09-01T00:00:00');
    const monthDays = generateMonthCalendar(targetMonth, sampleBookings);

    // Grid starts on Monday and ends on Sunday, covering full month weeks (35 or 42 cells)
    expect(monthDays.length % 7).toBe(0);
    expect(monthDays.length).toBeGreaterThanOrEqual(28);

    // Find 2026-09-20
    const sep20 = monthDays.find((d) => d.dateStr === '2026-09-20');
    expect(sep20).toBeDefined();
    expect(sep20?.bookingCount).toBe(2);
    expect(sep20?.totalRevenue).toBe(12000);
    expect(sep20?.totalCollected).toBe(8000);
    expect(sep20?.totalPending).toBe(4000);
    expect(sep20?.occupancyStatus).toBe('BOOKINGS_EXIST');
  });

  it('3. Computes chronological day schedule with intervening free slots between 5 AM and 11 PM', () => {
    // 5 AM (05:00) to 11 PM (23:00)
    // b-1 is 06:00 to 10:00
    // b-2 is 16:00 to 20:00
    // Expected schedule items:
    // 1. Free slot: 05:00 to 06:00 (1 hr)
    // 2. Booking: 06:00 to 10:00 (4 hrs)
    // 3. Free slot: 10:00 to 16:00 (6 hrs)
    // 4. Booking: 16:00 to 20:00 (4 hrs)
    // 5. Free slot: 20:00 to 23:00 (3 hrs)

    const scheduleItems = computeDayScheduleForFacility(testFacility, '2026-09-20', sampleBookings, 5, 23);

    expect(scheduleItems.length).toBe(5);

    // 1. First free slot
    expect(scheduleItems[0].type).toBe('FREE_SLOT');
    if (scheduleItems[0].type === 'FREE_SLOT') {
      expect(scheduleItems[0].startTime24).toBe('05:00');
      expect(scheduleItems[0].endTime24).toBe('06:00');
      expect(scheduleItems[0].durationMins).toBe(60);
      expect(scheduleItems[0].durationLabel).toBe('1 hr');
    }

    // 2. First booking
    expect(scheduleItems[1].type).toBe('BOOKING');
    if (scheduleItems[1].type === 'BOOKING') {
      expect(scheduleItems[1].startTime24).toBe('06:00');
      expect(scheduleItems[1].endTime24).toBe('10:00');
      expect(scheduleItems[1].booking.id).toBe('b-1');
    }

    // 3. Middle free slot
    expect(scheduleItems[2].type).toBe('FREE_SLOT');
    if (scheduleItems[2].type === 'FREE_SLOT') {
      expect(scheduleItems[2].startTime24).toBe('10:00');
      expect(scheduleItems[2].endTime24).toBe('16:00');
      expect(scheduleItems[2].durationMins).toBe(360);
      expect(scheduleItems[2].durationLabel).toBe('6 hrs');
    }

    // 4. Second booking
    expect(scheduleItems[3].type).toBe('BOOKING');
    if (scheduleItems[3].type === 'BOOKING') {
      expect(scheduleItems[3].startTime24).toBe('16:00');
      expect(scheduleItems[3].endTime24).toBe('20:00');
      expect(scheduleItems[3].booking.id).toBe('b-2');
    }

    // 5. Night free slot
    expect(scheduleItems[4].type).toBe('FREE_SLOT');
    if (scheduleItems[4].type === 'FREE_SLOT') {
      expect(scheduleItems[4].startTime24).toBe('20:00');
      expect(scheduleItems[4].endTime24).toBe('23:00');
      expect(scheduleItems[4].durationMins).toBe(180);
      expect(scheduleItems[4].durationLabel).toBe('3 hrs');
    }
  });

  it('4. Provides full-day free slot when facility has zero bookings', () => {
    const emptyFacilitySchedule = computeDayScheduleForFacility(
      testFacility,
      '2026-09-21',
      [], // No bookings
      5,
      23
    );

    expect(emptyFacilitySchedule.length).toBe(1);
    expect(emptyFacilitySchedule[0].type).toBe('FREE_SLOT');
    if (emptyFacilitySchedule[0].type === 'FREE_SLOT') {
      expect(emptyFacilitySchedule[0].startTime24).toBe('05:00');
      expect(emptyFacilitySchedule[0].endTime24).toBe('23:00');
      expect(emptyFacilitySchedule[0].durationMins).toBe(18 * 60); // 18 hours
      expect(emptyFacilitySchedule[0].durationLabel).toBe('18 hrs');
    }
  });
});
