import { addDays, differenceInMinutes, parseISO } from 'date-fns';

export const TIMELINE_START_HOUR = 5; // 05:00 AM
export const TIMELINE_TOTAL_HOURS = 21; // 05:00 AM to 02:00 AM next day
export const DEFAULT_HOUR_WIDTH_PX = 110;

/**
 * Creates safe start and end ISO strings from date string (YYYY-MM-DD) and time strings (HH:mm).
 * Automatically rolls end_time to next day if end_time <= start_time (e.g., 22:00 to 02:00).
 */
export function createSafeBookingInterval(
  dateStr: string,
  startTimeStr: string,
  endTimeStr: string
): { startIso: string; endIso: string; durationMins: number } {
  const [sh, sm] = startTimeStr.split(':').map(Number);
  const [eh, em] = endTimeStr.split(':').map(Number);

  const startDate = parseISO(`${dateStr}T${startTimeStr}:00`);
  let endDate = parseISO(`${dateStr}T${endTimeStr}:00`);

  let durationMins = (eh * 60 + em) - (sh * 60 + sm);

  // Crosses midnight: roll end date to the next calendar day
  if (durationMins <= 0) {
    endDate = addDays(endDate, 1);
    durationMins += 24 * 60;
  }

  return {
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    durationMins,
  };
}

/**
 * Calculates start offset (px) and width (px) for a booking on the 2D timeline.
 */
export function getTimelineCoordinates(
  startIso: string,
  endIso: string,
  viewDateStr: string,
  hourWidthPx: number = DEFAULT_HOUR_WIDTH_PX
): { left: number; width: number; isVisibleOnDate: boolean } {
  try {
    const bStart = parseISO(startIso);
    const bEnd = parseISO(endIso);
    const timelineOrigin = parseISO(`${viewDateStr}T05:00:00`);

    if (isNaN(bStart.getTime()) || isNaN(bEnd.getTime()) || isNaN(timelineOrigin.getTime())) {
      return { left: 0, width: 0, isVisibleOnDate: false };
    }

    const startOffsetMins = differenceInMinutes(bStart, timelineOrigin);
    const durationMins = differenceInMinutes(bEnd, bStart);

    const left = (startOffsetMins / 60) * hourWidthPx;
    const width = Math.max((durationMins / 60) * hourWidthPx, 44);

    const isVisibleOnDate = startOffsetMins >= -60 && startOffsetMins <= TIMELINE_TOTAL_HOURS * 60;

    return {
      left: isNaN(left) ? 0 : Math.round(left),
      width: isNaN(width) ? 44 : Math.round(width),
      isVisibleOnDate: Boolean(isVisibleOnDate),
    };
  } catch {
    return { left: 0, width: 0, isVisibleOnDate: false };
  }
}

/**
 * Formats duration nicely: "2 hrs 30 mins", "1 hr", "45 mins"
 */
export function formatDurationLabel(durationMins: number): string {
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;

  if (hours === 0) return `${mins} mins`;
  if (mins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} mins`;
}

export interface TimeSlotOption {
  value: string; // 24-hr format "HH:mm" e.g. "05:00", "05:30"
  label: string; // 12-hr format e.g. "5:00 AM", "5:30 AM"
}

/**
 * Converts 24-hr time string "HH:mm" to 12-hr display label e.g. "5:00 AM", "11:30 PM".
 */
export function formatTime12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Generates 30-minute intervals from startHour (default 5 AM) to endHour (default 11 PM).
 */
export function generateTimeSlots(
  startHour: number = 5,
  endHour: number = 23,
  intervalMins: number = 30
): TimeSlotOption[] {
  const slots: TimeSlotOption[] = [];
  const startMins = startHour * 60;
  const endMins = endHour * 60;

  for (let mins = startMins; mins <= endMins; mins += intervalMins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const label = formatTime12Hour(value);
    slots.push({ value, label });
  }

  return slots;
}

