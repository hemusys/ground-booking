import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isSameMonth,
  isToday as checkIsToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { Booking, Facility } from '../types';
import { formatTime12Hour, formatDurationLabel } from './time';

export type OccupancyStatus = 'EMPTY' | 'BOOKINGS_EXIST' | 'PARTIALLY_BOOKED' | 'FULLY_BOOKED';

export interface CalendarDaySummary {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  bookingCount: number;
  totalRevenue: number;
  totalCollected: number;
  totalPending: number;
  occupancyStatus: OccupancyStatus;
  bookings: Booking[];
}

export interface FreeSlot {
  type: 'FREE_SLOT';
  facilityId: string;
  facilityName: string;
  dateStr: string;
  startTime24: string; // "06:00"
  endTime24: string;   // "08:30"
  startTime12: string; // "6:00 AM"
  endTime12: string;   // "8:30 AM"
  durationMins: number;
  durationLabel: string;
}

export interface DayBookingItem {
  type: 'BOOKING';
  booking: Booking;
  startTime24: string;
  endTime24: string;
  startTime12: string;
  endTime12: string;
  durationMins: number;
  durationLabel: string;
}

export type DayScheduleItem = DayBookingItem | FreeSlot;

/**
 * Calculates occupancy status color coding:
 * - EMPTY: 0 bookings
 * - BOOKINGS_EXIST: 1-2 bookings (Green)
 * - PARTIALLY_BOOKED: 3-4 bookings (Yellow)
 * - FULLY_BOOKED: 5+ bookings (Red)
 */
export function getDayOccupancyStatus(bookingCount: number): OccupancyStatus {
  if (bookingCount === 0) return 'EMPTY';
  if (bookingCount <= 2) return 'BOOKINGS_EXIST';
  if (bookingCount <= 4) return 'PARTIALLY_BOOKED';
  return 'FULLY_BOOKED';
}

/**
 * Generates month calendar grid matrix (including previous/next month leading days).
 */
export function generateMonthCalendar(
  currentDate: Date,
  allBookings: Booking[]
): CalendarDaySummary[] {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const daysInterval = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Map bookings by date string
  const bookingsByDate = new Map<string, Booking[]>();
  allBookings.forEach((b) => {
    if (b.is_cancelled) return;
    const bDate = format(parseISO(b.start_time), 'yyyy-MM-dd');
    if (!bookingsByDate.has(bDate)) {
      bookingsByDate.set(bDate, []);
    }
    bookingsByDate.get(bDate)!.push(b);
  });

  return daysInterval.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayBookings = bookingsByDate.get(dateStr) || [];
    const bookingCount = dayBookings.length;

    let totalRevenue = 0;
    let totalCollected = 0;
    let totalPending = 0;

    dayBookings.forEach((b) => {
      totalRevenue += Number(b.total_amount || 0);
      totalCollected += Number(b.total_paid || 0);
      totalPending += Number(b.pending_amount || 0);
    });

    return {
      date: day,
      dateStr,
      isCurrentMonth: isSameMonth(day, monthStart),
      isToday: checkIsToday(day),
      bookingCount,
      totalRevenue,
      totalCollected,
      totalPending,
      occupancyStatus: getDayOccupancyStatus(bookingCount),
      bookings: dayBookings,
    };
  });
}

/**
 * Computes chronological schedule for a day with all bookings and intervening free slots (5:00 AM to 11:00 PM).
 */
export function computeDayScheduleForFacility(
  facility: Facility,
  dateStr: string,
  bookings: Booking[],
  dayStartHour: number = 5,
  dayEndHour: number = 23
): DayScheduleItem[] {
  const facilityBookings = bookings
    .filter((b) => b.facility_id === facility.id && !b.is_cancelled)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const items: DayScheduleItem[] = [];
  let currentPointerMins = dayStartHour * 60; // 05:00 AM in minutes (300)
  const dayEndMins = dayEndHour * 60;        // 11:00 PM in minutes (1380)

  for (const b of facilityBookings) {
    const bStart = parseISO(b.start_time);
    const bEnd = parseISO(b.end_time);

    const bStartMins = bStart.getHours() * 60 + bStart.getMinutes();
    let bEndMins = bEnd.getHours() * 60 + bEnd.getMinutes();
    if (bEndMins <= bStartMins) {
      bEndMins += 24 * 60; // Crosses midnight
    }

    // Check for free slot before this booking
    if (bStartMins > currentPointerMins) {
      const freeDuration = bStartMins - currentPointerMins;
      if (freeDuration >= 30) {
        const freeStartH = Math.floor(currentPointerMins / 60);
        const freeStartM = currentPointerMins % 60;
        const freeEndH = Math.floor(bStartMins / 60);
        const freeEndM = bStartMins % 60;

        const start24 = `${String(freeStartH).padStart(2, '0')}:${String(freeStartM).padStart(2, '0')}`;
        const end24 = `${String(freeEndH).padStart(2, '0')}:${String(freeEndM).padStart(2, '0')}`;

        items.push({
          type: 'FREE_SLOT',
          facilityId: facility.id,
          facilityName: facility.name,
          dateStr,
          startTime24: start24,
          endTime24: end24,
          startTime12: formatTime12Hour(start24),
          endTime12: formatTime12Hour(end24),
          durationMins: freeDuration,
          durationLabel: formatDurationLabel(freeDuration),
        });
      }
    }

    // Add booking item
    const bStartH = Math.floor(bStartMins / 60);
    const bStartM = bStartMins % 60;
    const bEndH = Math.floor(bEndMins / 60);
    const bEndM = bEndMins % 60;
    const start24 = `${String(bStartH).padStart(2, '0')}:${String(bStartM).padStart(2, '0')}`;
    const end24 = `${String(bEndH).padStart(2, '0')}:${String(bEndM).padStart(2, '0')}`;
    const durationMins = bEndMins - bStartMins;

    items.push({
      type: 'BOOKING',
      booking: b,
      startTime24: start24,
      endTime24: end24,
      startTime12: formatTime12Hour(start24),
      endTime12: formatTime12Hour(end24),
      durationMins,
      durationLabel: formatDurationLabel(durationMins),
    });

    currentPointerMins = Math.max(currentPointerMins, bEndMins);
  }

  // Check for remaining free slot until dayEndHour
  if (currentPointerMins < dayEndMins) {
    const freeDuration = dayEndMins - currentPointerMins;
    if (freeDuration >= 30) {
      const freeStartH = Math.floor(currentPointerMins / 60);
      const freeStartM = currentPointerMins % 60;
      const freeEndH = Math.floor(dayEndMins / 60);
      const freeEndM = dayEndMins % 60;

      const start24 = `${String(freeStartH).padStart(2, '0')}:${String(freeStartM).padStart(2, '0')}`;
      const end24 = `${String(freeEndH).padStart(2, '0')}:${String(freeEndM).padStart(2, '0')}`;

      items.push({
        type: 'FREE_SLOT',
        facilityId: facility.id,
        facilityName: facility.name,
        dateStr,
        startTime24: start24,
        endTime24: end24,
        startTime12: formatTime12Hour(start24),
        endTime12: formatTime12Hour(end24),
        durationMins: freeDuration,
        durationLabel: formatDurationLabel(freeDuration),
      });
    }
  }

  return items;
}
