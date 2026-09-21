import React from 'react';
import { Booking, Facility } from '../../types';
import { formatTimeDisplay, formatDateDisplay } from '../../lib/utils';
import { AlertTriangle, X, ShieldAlert, Check } from 'lucide-react';

interface ConflictModalProps {
  isOpen: boolean;
  conflictingBooking: Booking | null;
  facility: Facility | null;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  onCancel: () => void;
  onForceBook: () => void;
  isSubmitting?: boolean;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  conflictingBooking,
  facility,
  requestedDate,
  requestedStartTime,
  requestedEndTime,
  onCancel,
  onForceBook,
  isSubmitting = false,
}) => {
  if (!isOpen || !conflictingBooking) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-[#09090b] border border-rose-500/40 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-rose-100 leading-none">
                Booking Conflict
              </h3>
              <p className="text-[11px] text-rose-300/80 mt-0.5">
                Facility already reserved during this time
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Conflicting Booking Details Card */}
          <div className="p-3.5 rounded-xl bg-[#18181b] border border-rose-500/30 space-y-2">
            <div className="text-[10px] text-rose-400 uppercase font-bold tracking-wider">
              Existing Conflicting Booking
            </div>

            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-bold text-[#f4f4f5] block">
                  {conflictingBooking.customer?.name || 'Booked Customer'}
                </span>
                {conflictingBooking.customer?.team_name && (
                  <span className="text-xs text-emerald-400 font-medium block">
                    🏏 {conflictingBooking.customer.team_name}
                  </span>
                )}
                <span className="text-xs font-mono text-[#a1a1aa]">
                  +91 {conflictingBooking.customer?.phone}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#27272a] text-xs font-semibold text-[#f4f4f5]">
                {facility?.name || conflictingBooking.facility?.name || 'Facility'}
              </span>
            </div>

            <div className="pt-2 border-t border-[#27272a] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-[#a1a1aa] block uppercase">Date</span>
                <span className="font-medium text-[#f4f4f5]">
                  {formatDateDisplay(conflictingBooking.start_time)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#a1a1aa] block uppercase">Time Slot</span>
                <span className="font-mono font-bold text-rose-400">
                  {formatTimeDisplay(conflictingBooking.start_time)} – {formatTimeDisplay(conflictingBooking.end_time)}
                </span>
              </div>
            </div>
          </div>

          {/* Requested Slot */}
          <div className="p-3 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-[#a1a1aa] block uppercase">Your Requested Time</span>
              <span className="font-mono font-bold text-amber-300">
                {requestedStartTime} – {requestedEndTime}
              </span>
            </div>
            <span className="text-[11px] text-amber-400 font-medium">
              Overlaps with existing slot
            </span>
          </div>

          {/* Warning notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Force booking will mark this slot with a conflict override flag (<code className="text-amber-300 font-mono text-[10px]">is_conflict_override</code>).
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#18181b] border-t border-[#27272a] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onForceBook}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Force Book Slot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
