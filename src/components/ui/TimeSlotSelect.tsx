import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TimeSlotOption, generateTimeSlots, formatTime12Hour } from '../../lib/time';
import { ChevronDown, Search, Check, Clock } from 'lucide-react';

interface TimeSlotSelectProps {
  value: string; // 24-hr format "HH:mm" e.g. "06:00"
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  isInvalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  startHour?: number; // default 5 (5:00 AM)
  endHour?: number; // default 23 (11:00 PM)
  intervalMins?: number; // default 30
}

export const TimeSlotSelect: React.FC<TimeSlotSelectProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select time',
  isInvalid = false,
  errorMessage,
  disabled = false,
  startHour = 5,
  endHour = 23,
  intervalMins = 30,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const allSlots = useMemo(
    () => generateTimeSlots(startHour, endHour, intervalMins),
    [startHour, endHour, intervalMins]
  );

  // Search filter
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return allSlots;
    const q = searchQuery.toLowerCase().trim().replace(/[:\s]/g, '');
    return allSlots.filter((slot) => {
      const matchLabel = slot.label.toLowerCase().replace(/[:\s]/g, '').includes(q);
      const matchVal = slot.value.replace(/[:\s]/g, '').includes(q);
      return matchLabel || matchVal;
    });
  }, [allSlots, searchQuery]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Autofocus search input and scroll to selected value on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({ block: 'nearest' });
        }
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedSlot = allSlots.find((s) => s.value === value);
  const displayLabel = selectedSlot ? selectedSlot.label : value ? formatTime12Hour(value) : placeholder;

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button (shadcn styled) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-[#09090b] border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between font-mono transition-colors focus:outline-hidden ${
          isInvalid
            ? 'border-rose-500 text-rose-300 ring-1 ring-rose-500/20'
            : isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 text-[#f4f4f5]'
            : 'border-[#27272a] text-[#f4f4f5] hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="flex items-center gap-2 truncate">
          <Clock className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
          <span className={selectedSlot ? 'text-[#f4f4f5] font-medium' : 'text-[#71717a]'}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#a1a1aa] transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Content (shadcn Popover / Command Menu style) */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-[#09090b] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-[#27272a] bg-[#18181b]/90 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search time (e.g. 6:30, PM)..."
              className="w-full bg-transparent text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-hidden"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Enter' && filteredSlots.length > 0) {
                  e.preventDefault();
                  onChange(filteredSlots[0].value);
                  setIsOpen(false);
                }
              }}
            />
          </div>

          {/* Time Slot List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1 divide-y divide-zinc-900/50 scrollbar-thin scrollbar-thumb-zinc-700"
          >
            {filteredSlots.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#71717a]">
                No matching time slots
              </div>
            ) : (
              filteredSlots.map((slot) => {
                const isSelected = slot.value === value;
                return (
                  <button
                    key={slot.value}
                    ref={isSelected ? selectedItemRef : null}
                    type="button"
                    onClick={() => {
                      onChange(slot.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors text-left font-mono ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                        : 'text-[#d4d4d8] hover:bg-[#18181b] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <span>{slot.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {errorMessage && (
        <p className="mt-1 text-xs text-rose-400">{errorMessage}</p>
      )}
    </div>
  );
};
