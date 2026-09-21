import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Booking, Facility } from '../types';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { generateMonthCalendar, computeDayScheduleForFacility, OccupancyStatus } from '../lib/calendar';
import { useUIStore } from '../stores/useUIStore';
import { MiniCalendarPicker } from '../components/ui/MiniCalendarPicker';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { cancelBooking, recordPayment } from '../lib/api';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  format,
  parseISO,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isToday as checkIsToday,
} from 'date-fns';

interface CalendarPageProps {
  facilities: Facility[];
  bookings: Booking[];
  refetch: () => Promise<void>;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  facilities,
  bookings,
  refetch,
}) => {
  const { date: paramDate } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const { openQuickBook } = useUIStore();

  // State for Month View
  const initialDate = paramDate ? parseISO(`${paramDate}T00:00:00`) : new Date();
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate);

  // State for Day Schedule View filter
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('ALL');

  // Modal states for Day Schedule actions
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);

  // If URL has `:date` param, we render the Day Schedule View. Otherwise, Month View.
  const isDayView = Boolean(paramDate);
  const activeDayStr = paramDate || format(new Date(), 'yyyy-MM-dd');
  const activeDayDate = parseISO(`${activeDayStr}T00:00:00`);

  // --- MONTH VIEW COMPUTATIONS ---
  const monthCalendarDays = useMemo(() => {
    return generateMonthCalendar(currentMonthDate, bookings);
  }, [currentMonthDate, bookings]);

  const monthSummary = useMemo(() => {
    let totalBookings = 0;
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalPending = 0;

    monthCalendarDays.forEach((day) => {
      if (day.isCurrentMonth) {
        totalBookings += day.bookingCount;
        totalRevenue += day.totalRevenue;
        totalCollected += day.totalCollected;
        totalPending += day.totalPending;
      }
    });

    return { totalBookings, totalRevenue, totalCollected, totalPending };
  }, [monthCalendarDays]);

  // --- DAY SCHEDULE VIEW COMPUTATIONS ---
  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => !b.is_cancelled && format(parseISO(b.start_time), 'yyyy-MM-dd') === activeDayStr)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [bookings, activeDayStr]);

  const daySummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalPending = 0;

    dayBookings.forEach((b) => {
      totalRevenue += Number(b.total_amount || 0);
      totalCollected += Number(b.total_paid || 0);
      totalPending += Number(b.pending_amount || 0);
    });

    return {
      totalBookings: dayBookings.length,
      totalRevenue,
      totalCollected,
      totalPending,
    };
  }, [dayBookings]);

  // Generate facility schedules (including free slots)
  const activeFacilities = useMemo(() => {
    if (selectedFacilityId === 'ALL') return facilities;
    return facilities.filter((f) => f.id === selectedFacilityId);
  }, [facilities, selectedFacilityId]);

  const daySchedulesByFacility = useMemo(() => {
    return activeFacilities.map((fac) => ({
      facility: fac,
      items: computeDayScheduleForFacility(fac, activeDayStr, dayBookings, 5, 23),
    }));
  }, [activeFacilities, activeDayStr, dayBookings]);

  // Handle Cancellation
  const handleCancel = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await refetch();
  };

  // Status color helper for calendar cells
  const getStatusColorClasses = (status: OccupancyStatus) => {
    switch (status) {
      case 'BOOKINGS_EXIST':
        return {
          border: 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
          text: 'text-emerald-400',
          dot: 'bg-emerald-400',
        };
      case 'PARTIALLY_BOOKED':
        return {
          border: 'border-amber-500/40 bg-amber-950/20 hover:border-amber-400',
          badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
          text: 'text-amber-400',
          dot: 'bg-amber-400',
        };
      case 'FULLY_BOOKED':
        return {
          border: 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400',
          badge: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          text: 'text-rose-400',
          dot: 'bg-rose-400',
        };
      default:
        return {
          border: 'border-[#27272a] bg-[#18181b]/50 hover:border-zinc-500 hover:bg-[#18181b]',
          badge: 'bg-zinc-800 text-zinc-400',
          text: 'text-zinc-500',
          dot: 'bg-zinc-600',
        };
    }
  };

  // ==========================================
  // VIEW 1: DAY SCHEDULE VIEW (/calendar/:date)
  // ==========================================
  if (isDayView) {
    const isTodayActive = checkIsToday(activeDayDate);

    return (
      <div className="space-y-4 sm:space-y-6 pb-20 md:pb-6">
        {/* Navigation & Header Bar */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Link
                to="/calendar"
                className="p-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Back to Month Calendar"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Month View</span>
              </Link>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#f4f4f5] leading-tight flex items-center gap-2">
                  <span>{format(activeDayDate, 'EEEE, dd MMMM yyyy')}</span>
                  {isTodayActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                      Today
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#a1a1aa]">
                  Timeline Schedule & Free Slots (5:00 AM – 11:00 PM)
                </p>
              </div>
            </div>

            {/* Date Jump Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#09090b] border border-[#27272a] rounded-lg p-0.5 text-xs">
                <button
                  onClick={() =>
                    navigate(`/calendar/${format(subDays(activeDayDate, 1), 'yyyy-MM-dd')}`)
                  }
                  className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5]"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    navigate(`/calendar/${format(new Date(), 'yyyy-MM-dd')}`)
                  }
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    isTodayActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-[#f4f4f5] hover:bg-[#27272a]'
                  }`}
                >
                  Today
                </button>

                <button
                  onClick={() =>
                    navigate(`/calendar/${format(addDays(activeDayDate, 1), 'yyyy-MM-dd')}`)
                  }
                  className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5]"
                  title="Next Day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Mini Calendar Date Picker */}
              <MiniCalendarPicker
                selectedDateStr={activeDayStr}
                onSelectDate={(newDate) => navigate(`/calendar/${newDate}`)}
              />

              {/* Quick Book on this day */}
              <button
                onClick={() => openQuickBook({ date: activeDayStr })}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline">Quick Book</span>
              </button>
            </div>
          </div>

          {/* Daily Operational Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#27272a]">
            <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Total Bookings</span>
              <span className="text-base font-bold font-mono text-[#f4f4f5]">
                {daySummary.totalBookings}
              </span>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Total Fee</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatCurrency(daySummary.totalRevenue)}
              </span>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Collected</span>
              <span className="text-base font-bold font-mono text-[#f4f4f5]">
                {formatCurrency(daySummary.totalCollected)}
              </span>
            </div>

            <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
              <span className="text-[10px] text-amber-400 uppercase font-bold block">Pending Due</span>
              <span className="text-base font-bold font-mono text-amber-400">
                {formatCurrency(daySummary.totalPending)}
              </span>
            </div>
          </div>
        </div>

        {/* Facility Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setSelectedFacilityId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              selectedFacilityId === 'ALL'
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
            }`}
          >
            All Facilities ({facilities.length})
          </button>
          {facilities.map((fac) => {
            const facBookingsCount = dayBookings.filter((b) => b.facility_id === fac.id).length;
            return (
              <button
                key={fac.id}
                type="button"
                onClick={() => setSelectedFacilityId(fac.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1.5 ${
                  selectedFacilityId === fac.id
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <span>{fac.name}</span>
                {facBookingsCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    selectedFacilityId === fac.id ? 'bg-zinc-950/30 text-zinc-950 font-bold' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {facBookingsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chronological Schedule Cards per Facility */}
        <div className="space-y-6">
          {daySchedulesByFacility.map(({ facility, items }) => (
            <div
              key={facility.id}
              className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg"
            >
              {/* Facility Header */}
              <div className="px-4 py-3 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-[#27272a] text-emerald-400 text-xs">
                    🏏
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-[#f4f4f5]">
                      {facility.name}
                    </h3>
                    <span className="text-[11px] text-[#a1a1aa]">
                      {facility.type} • ₹{facility.hourly_rate}/hr
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openQuickBook({
                      facilityId: facility.id,
                      date: activeDayStr,
                      startTime: '06:00',
                    })
                  }
                  className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-emerald-500/20 hover:text-emerald-300 text-xs font-semibold text-[#a1a1aa] flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Slot</span>
                </button>
              </div>

              {/* Items List (Bookings + Intervening Free Slots) */}
              <div className="p-3 sm:p-4 space-y-2.5">
                {items.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#71717a]">
                    No activity scheduled for this facility.
                  </div>
                ) : (
                  items.map((item, idx) => {
                    if (item.type === 'FREE_SLOT') {
                      return (
                        <div
                          key={`free-${idx}`}
                          className="p-3 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-emerald-950/20 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🌿</span>
                            <div>
                              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 font-mono">
                                <span>{item.startTime12} – {item.endTime12}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-normal">
                                  {item.durationLabel} Free Slot
                                </span>
                              </div>
                              <span className="text-[11px] text-[#a1a1aa]">
                                Available for immediate booking
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openQuickBook({
                                facilityId: item.facilityId,
                                date: item.dateStr,
                                startTime: item.startTime24,
                              })
                            }
                            className="px-3 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500 hover:text-zinc-950 text-emerald-300 text-xs font-semibold transition-all self-start sm:self-center flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Quick Book Slot</span>
                          </button>
                        </div>
                      );
                    }

                    // Booking Item
                    const booking = item.booking;
                    const isPaid = booking.payment_status === 'FULLY_PAID';
                    const isPartial = booking.payment_status === 'PARTIALLY_PAID';
                    const pendingAmt = booking.pending_amount || 0;

                    const whatsAppLink = buildWhatsAppBookingLink({
                      phone: booking.customer?.phone || '',
                      facilityName: facility.name,
                      startIso: booking.start_time,
                      endIso: booking.end_time,
                      totalAmount: booking.total_amount,
                      advancePaid: booking.total_paid || 0,
                      pendingAmount: pendingAmt,
                    });

                    return (
                      <div
                        key={booking.id}
                        className="p-3.5 rounded-xl bg-[#09090b] border border-[#27272a] hover:border-zinc-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Left: Time & Customer Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold font-mono text-[#f4f4f5] flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              {item.startTime12} – {item.endTime12}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#27272a] text-[#a1a1aa]">
                              {item.durationLabel}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : isPartial
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {booking.payment_status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-sm font-bold text-[#f4f4f5]">
                              {booking.customer?.name}
                            </span>
                            {booking.customer?.team_name && (
                              <span className="text-xs text-emerald-400 font-medium">
                                • {booking.customer.team_name}
                              </span>
                            )}
                            <span className="text-xs font-mono text-[#a1a1aa]">
                              +91 {booking.customer?.phone}
                            </span>
                          </div>

                          {booking.notes && (
                            <p className="text-[11px] text-[#a1a1aa] italic">
                              "{booking.notes}"
                            </p>
                          )}
                        </div>

                        {/* Right: Financials & Action Buttons */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#27272a]">
                          {/* Financial Breakdown */}
                          <div className="text-right">
                            <div className="text-xs font-bold font-mono-numeric text-[#f4f4f5]">
                              {formatCurrency(booking.total_amount)}
                            </div>
                            {pendingAmt > 0 ? (
                              <div className="text-[11px] font-bold font-mono-numeric text-amber-400">
                                Due: {formatCurrency(pendingAmt)}
                              </div>
                            ) : (
                              <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-0.5 justify-end">
                                <CheckCircle2 className="w-3 h-3" /> Settled
                              </div>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5">
                            {/* WhatsApp Button */}
                            <a
                              href={whatsAppLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                              title="Send WhatsApp Confirmation"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>

                            {/* Collect Due Button */}
                            {pendingAmt > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedBookingForPayment(booking)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors"
                              >
                                Collect
                              </button>
                            )}

                            {/* View Full Details Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedBookingForDetails(booking)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold text-xs transition-colors"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Modals */}
        {selectedBookingForDetails && (
          <BookingDetailModal
            booking={selectedBookingForDetails}
            onClose={() => setSelectedBookingForDetails(null)}
            onOpenCollectPayment={(b) => {
              setSelectedBookingForDetails(null);
              setSelectedBookingForPayment(b);
            }}
            onCancelBooking={handleCancel}
            onRefresh={refetch}
          />
        )}

        {selectedBookingForPayment && (
          <CollectPaymentModal
            booking={selectedBookingForPayment}
            onClose={() => setSelectedBookingForPayment(null)}
            onCollect={async (bookingId, amount, method, notes) => {
              await recordPayment(bookingId, amount, method, notes);
              await refetch();
              setSelectedBookingForPayment(null);
            }}
          />
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MONTHLY CALENDAR VIEW (/calendar)
  // ==========================================
  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-6">
      {/* Month Header Navigation Bar */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-lg">
              📅
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#f4f4f5] leading-tight">
                {format(currentMonthDate, 'MMMM yyyy')}
              </h2>
              <p className="text-xs text-[#a1a1aa]">
                Click any day to view detailed schedule & free slots
              </p>
            </div>
          </div>

          {/* Month Controls & Date Picker */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#09090b] border border-[#27272a] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
                className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5]"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentMonthDate(new Date())}
                className="px-2.5 py-1 rounded font-medium text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
              >
                Today
              </button>

              <button
                onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
                className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5]"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mini Calendar Picker to jump to any specific date */}
            <MiniCalendarPicker
              selectedDateStr={format(currentMonthDate, 'yyyy-MM-dd')}
              onSelectDate={(newDate) => {
                navigate(`/calendar/${newDate}`);
              }}
              buttonLabel="Jump to Date"
            />

            {/* Quick Book */}
            <button
              onClick={() => openQuickBook({ date: format(new Date(), 'yyyy-MM-dd') })}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Quick Book</span>
            </button>
          </div>
        </div>

        {/* Monthly Metrics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#27272a]">
          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Monthly Bookings</span>
            <span className="text-base font-bold font-mono text-[#f4f4f5]">
              {monthSummary.totalBookings}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Monthly Revenue</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {formatCurrency(monthSummary.totalRevenue)}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Total Collected</span>
            <span className="text-base font-bold font-mono text-[#f4f4f5]">
              {formatCurrency(monthSummary.totalCollected)}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Pending Balance</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {formatCurrency(monthSummary.totalPending)}
            </span>
          </div>
        </div>

        {/* Color Legend Bar */}
        <div className="flex items-center gap-3 text-xs pt-1 flex-wrap text-[#a1a1aa]">
          <span className="text-[11px] font-bold text-[#71717a] uppercase tracking-wider">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Bookings Exist (1-2)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-zinc-300">Partially Booked (3-4)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="text-zinc-300">Fully Booked (5+)</span>
          </div>
        </div>
      </div>

      {/* 7-Column Monthly Calendar Grid */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-[#27272a] bg-[#09090b] text-center text-xs font-bold text-[#a1a1aa] py-2.5">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span className="text-emerald-400">Sat</span>
          <span className="text-emerald-400">Sun</span>
        </div>

        {/* Days Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#27272a] bg-[#09090b]">
          {monthCalendarDays.map((daySummary) => {
            const styles = getStatusColorClasses(daySummary.occupancyStatus);

            return (
              <div
                key={daySummary.dateStr}
                onClick={() => navigate(`/calendar/${daySummary.dateStr}`)}
                className={`min-h-[90px] sm:min-h-[110px] p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                  styles.border
                } ${!daySummary.isCurrentMonth ? 'opacity-35 bg-zinc-950/90' : ''}`}
              >
                {/* Cell Header: Day Number & Today indicator */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono ${
                      daySummary.isToday
                        ? 'h-6 w-6 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold shadow-xs'
                        : daySummary.isCurrentMonth
                        ? 'text-[#f4f4f5]'
                        : 'text-[#71717a]'
                    }`}
                  >
                    {format(daySummary.date, 'd')}
                  </span>

                  {daySummary.isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      Today
                    </span>
                  )}
                </div>

                {/* Cell Body: Booking Stats & Revenue */}
                <div className="space-y-1 my-1">
                  {daySummary.bookingCount > 0 ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        <span className="text-[11px] font-bold font-mono text-[#f4f4f5]">
                          {daySummary.bookingCount} {daySummary.bookingCount === 1 ? 'booking' : 'bookings'}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold font-mono-numeric text-emerald-400">
                        {formatCurrency(daySummary.totalRevenue)}
                      </div>

                      {daySummary.totalPending > 0 && (
                        <div className="text-[10px] font-mono-numeric text-amber-400 font-semibold">
                          ₹{daySummary.totalPending} due
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-[#52525b] font-medium hidden sm:inline">
                      Available
                    </span>
                  )}
                </div>

                {/* Cell Footer: Quick Status Pill */}
                <div className="text-right">
                  {daySummary.bookingCount > 0 && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${styles.badge}`}>
                      {daySummary.occupancyStatus === 'BOOKINGS_EXIST'
                        ? 'Active'
                        : daySummary.occupancyStatus === 'PARTIALLY_BOOKED'
                        ? 'Busy'
                        : 'Full'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
