import React, { useState, useRef, useEffect } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MiniCalendarPickerProps {
  selectedDateStr: string; // "YYYY-MM-DD"
  onSelectDate: (dateStr: string) => void;
  buttonLabel?: string;
  className?: string;
}

export const MiniCalendarPicker: React.FC<MiniCalendarPickerProps> = ({
  selectedDateStr,
  onSelectDate,
  buttonLabel,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseISO(`${selectedDateStr}T00:00:00`);
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentMonth(parseISO(`${selectedDateStr}T00:00:00`));
  }, [selectedDateStr]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleSelectDay = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd');
    onSelectDate(formatted);
    setIsOpen(false);
  };

  const handleGoToday = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    onSelectDate(todayStr);
    setCurrentMonth(new Date());
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] hover:border-zinc-500 text-xs font-medium text-[#f4f4f5] transition-colors"
        title="Choose Date"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span>{buttonLabel || format(selectedDate, 'dd MMM yyyy')}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 z-50 w-72 bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#27272a]">
            <span className="text-xs font-bold text-[#f4f4f5]">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#71717a] mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isCurrent = isSameMonth(day, monthStart);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto rounded-md text-xs font-mono flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                      : isToday
                      ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                      : isCurrent
                      ? 'text-[#f4f4f5] hover:bg-[#18181b]'
                      : 'text-[#52525b] hover:bg-[#18181b]/50'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Footer Jump to Today */}
          <div className="mt-2.5 pt-2 border-t border-[#27272a] flex justify-between items-center text-[11px]">
            <button
              type="button"
              onClick={handleGoToday}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Today ({format(new Date(), 'dd MMM')})
            </button>
            <span className="text-[#71717a] font-mono text-[10px]">
              {selectedDateStr}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
