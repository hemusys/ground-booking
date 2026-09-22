import React, { useRef, useEffect, useState } from 'react';
import { Facility, Booking } from '../types';
import { formatCurrency, formatTimeDisplay } from '../lib/utils';
import { TIMELINE_START_HOUR, TIMELINE_TOTAL_HOURS, DEFAULT_HOUR_WIDTH_PX, getTimelineCoordinates } from '../lib/time';
import { format, isSameDay, differenceInMinutes, addMinutes, startOfDay } from 'date-fns';
import { Clock, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { getMaskedBookingsForRole } from '../lib/api';

interface TimelineGridProps {
  facilities: Facility[];
  bookings: Booking[];
  selectedDate: Date;
  onSlotClick: (facility: Facility, timeSlot: string) => void;
  onBookingClick: (booking: Booking) => void;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  facilities,
  bookings,
  selectedDate,
  onSlotClick,
  onBookingClick,
}) => {
  const { currentRole, activeBrokerId } = useUIStore();
  const displayBookings = React.useMemo(() => {
    return getMaskedBookingsForRole(bookings, currentRole, activeBrokerId);
  }, [bookings, currentRole, activeBrokerId]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const hasScrolledRef = useRef(false);

  // Update current time every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Hour marks 05:00 to 02:00 (Next Day)
  const hours = React.useMemo(() => {
    return Array.from({ length: TIMELINE_TOTAL_HOURS }, (_, i) => {
      const hour24 = (TIMELINE_START_HOUR + i) % 24;
      const isNextDay = TIMELINE_START_HOUR + i >= 24;
      const period = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return {
        hour24,
        display: `${hour12} ${period}${isNextDay ? ' (+1)' : ''}`,
        rawIndex: i,
      };
    });
  }, []);

  // Reset auto-scroll flag when date changes
  useEffect(() => {
    hasScrolledRef.current = false;
  }, [selectedDateStr]);

  // Calculate current time line offset if today is selected
  const isViewingToday = isSameDay(selectedDate, currentTime);
  const currentMinutesFromStart = isViewingToday
    ? differenceInMinutes(currentTime, addMinutes(startOfDay(selectedDate), TIMELINE_START_HOUR * 60))
    : -1;
  const currentPositionPx = currentMinutesFromStart >= 0 && currentMinutesFromStart <= TIMELINE_TOTAL_HOURS * 60
    ? (currentMinutesFromStart / 60) * DEFAULT_HOUR_WIDTH_PX
    : -1;

  // Auto-scroll near current time on load
  useEffect(() => {
    if (!hasScrolledRef.current && scrollContainerRef.current && currentPositionPx > 250) {
      scrollContainerRef.current.scrollLeft = currentPositionPx - 180;
      hasScrolledRef.current = true;
    }
  }, [currentPositionPx]);

  return (
    <div className="w-full bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
      
      {/* Legend & Tooltip Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#18181b] border-b border-[#27272a] text-xs">
        <div className="flex items-center gap-4 font-medium">
          <span className="text-[#a1a1aa] hidden sm:inline">Status:</span>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
            <span>Advance Paid (Due)</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
            <span>Unpaid</span>
          </div>
        </div>

        <div className="text-[11px] text-[#a1a1aa] hidden sm:block">
          💡 Click free space to <span className="text-emerald-400 font-semibold">Quick Book</span>
        </div>
      </div>

      {/* Synchronized Scroll Matrix */}
      <div className="flex overflow-hidden">
        
        {/* Left Sticky Facilities Column */}
        <div className="w-32 sm:w-44 shrink-0 bg-[#18181b] border-r border-[#27272a] z-20 shadow-md">
          <div className="h-10 px-3 flex items-center justify-between border-b border-[#27272a] bg-[#18181b] text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">
            <span>Facility</span>
            <span className="text-[10px] text-[#71717a] font-mono">Rate/hr</span>
          </div>

          {facilities.map((fac) => (
            <div
              key={fac.id}
              className="h-20 px-3 flex flex-col justify-center border-b border-[#27272a] hover:bg-[#27272a]/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs sm:text-sm text-[#f4f4f5] truncate">
                  {fac.name}
                </span>
                <span className="text-[11px] font-mono-numeric text-emerald-400 font-medium">
                  ₹{fac.hourly_rate}
                </span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium w-max mt-0.5 border ${
                fac.type === 'GROUND'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : fac.type === 'TURF_NET'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {fac.type === 'GROUND' ? '🏟️ Ground' : fac.type === 'TURF_NET' ? '🌱 Turf Net' : '🏏 Net'}
              </span>
            </div>
          ))}
        </div>

        {/* Right Horizontal Hours Track */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto relative"
          style={{ cursor: 'crosshair' }}
        >
          <div style={{ width: `${TIMELINE_TOTAL_HOURS * DEFAULT_HOUR_WIDTH_PX}px` }} className="relative">
            
            {/* Top Time Scale */}
            <div className="h-10 border-b border-[#27272a] bg-[#18181b]/70 flex select-none">
              {hours.map((h) => (
                <div
                  key={h.rawIndex}
                  style={{ width: `${DEFAULT_HOUR_WIDTH_PX}px` }}
                  className="h-full border-r border-[#27272a]/60 px-2 flex items-center justify-start text-[11px] font-mono text-[#a1a1aa] shrink-0"
                >
                  <Clock className="w-3 h-3 mr-1 text-[#71717a]" />
                  {h.display}
                </div>
              ))}
            </div>

            {/* Current Time Bar with Live NOW Badge */}
            {isViewingToday && currentPositionPx >= 0 && (
              <div
                style={{ left: `${currentPositionPx}px` }}
                className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.9)]"
              >
                <div className="absolute -top-3 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-mono font-bold tracking-wider shadow-md flex items-center gap-1 border border-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>NOW</span>
                </div>
              </div>
            )}

            {/* Facility Rows with Clickable Slots */}
            {facilities.map((fac) => {
              const facBookings = displayBookings.filter((b) => b.facility_id === fac.id);

              return (
                <div
                  key={fac.id}
                  className="h-20 border-b border-[#27272a] relative flex items-center bg-[#09090b]/40 hover:bg-[#18181b]/20 transition-colors"
                >
                  {/* Background 30-min clickable slots */}
                  {hours.map((h) => {
                    const timeSlot1 = `${String(h.hour24).padStart(2, '0')}:00`;
                    const timeSlot2 = `${String(h.hour24).padStart(2, '0')}:30`;

                    return (
                      <div
                        key={h.rawIndex}
                        style={{ width: `${DEFAULT_HOUR_WIDTH_PX}px` }}
                        className="h-full border-r border-[#27272a]/30 shrink-0 flex"
                      >
                        <button
                          type="button"
                          onClick={() => onSlotClick(fac, timeSlot1)}
                          className="w-1/2 h-full hover:bg-emerald-500/10 transition-colors border-r border-dashed border-[#27272a]/20"
                          title={`Book ${fac.name} at ${timeSlot1}`}
                        />
                        <button
                          type="button"
                          onClick={() => onSlotClick(fac, timeSlot2)}
                          className="w-1/2 h-full hover:bg-emerald-500/10 transition-colors"
                          title={`Book ${fac.name} at ${timeSlot2}`}
                        />
                      </div>
                    );
                  })}

                  {/* Rendered Bookings on this facility row */}
                  {facBookings.map((b) => {
                    const { left, width, isVisibleOnDate } = getTimelineCoordinates(b.start_time, b.end_time, selectedDateStr);
                    if (!isVisibleOnDate) return null;

                    const isMasked = b.is_masked;
                    const isPaid = b.payment_status === 'FULLY_PAID';
                    const isPartial = b.payment_status === 'PARTIALLY_PAID';

                    if (isMasked) {
                      return (
                        <div
                          key={b.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookingClick(b);
                          }}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                          }}
                          className="absolute top-1.5 bottom-1.5 rounded-lg border px-2.5 py-1 z-10 cursor-pointer overflow-hidden bg-zinc-800/90 border-zinc-600 text-zinc-300 shadow-md hover:border-zinc-400"
                        >
                          <div className="flex items-center justify-between gap-1 leading-tight">
                            <span className="font-bold text-xs flex items-center gap-1 text-zinc-200">
                              <Lock className="w-3 h-3 text-zinc-400" /> BOOKED
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400">
                              {formatTimeDisplay(b.start_time)}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                            Slot Reserved
                          </div>
                        </div>
                      );
                    }

                    const matchLabel = b.team_b_name
                      ? `🏏 ${b.team_a_name || b.customer?.name} vs ${b.team_b_name}`
                      : b.customer?.team_name
                      ? `🏏 ${b.customer.team_name}`
                      : formatTimeDisplay(b.start_time);

                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onBookingClick(b);
                        }}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2.5 py-1 z-10 cursor-pointer overflow-hidden transition-all duration-150 hover:scale-[1.01] hover:z-20 shadow-md ${
                          isPaid
                            ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-100 hover:border-emerald-400'
                            : isPartial
                            ? 'bg-amber-950/85 border-amber-500/70 text-amber-100 hover:border-amber-400'
                            : 'bg-rose-950/85 border-rose-500/70 text-rose-100 hover:border-rose-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-bold text-xs truncate">
                            {b.customer?.name || b.team_a_name || 'Customer'}
                          </span>
                          {currentRole === 'OWNER' ? (
                            <span className="font-mono-numeric text-[11px] font-semibold shrink-0">
                              {formatCurrency(b.total_amount)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-emerald-300">
                              My Booking
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] text-[#f4f4f5]/80 mt-0.5 truncate">
                          <span className="truncate">
                            {matchLabel}
                          </span>

                          {currentRole === 'OWNER' && (
                            isPaid ? (
                              <span className="shrink-0 flex items-center text-emerald-400 font-medium">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Paid
                              </span>
                            ) : isPartial ? (
                              <span className="shrink-0 flex items-center text-amber-400 font-semibold font-mono">
                                Due: ₹{b.pending_amount}
                              </span>
                            ) : (
                              <span className="shrink-0 flex items-center text-rose-400 font-semibold font-mono">
                                UNPAID
                              </span>
                            )
                          )}
                        </div>

                        {width > 120 && (
                          <div className="text-[9px] text-[#a1a1aa] mt-0.5 font-mono truncate">
                            {formatTimeDisplay(b.start_time)} - {formatTimeDisplay(b.end_time)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                </div>
              );
            })}

          </div>
        </div>

      </div>

    </div>
  );
};
