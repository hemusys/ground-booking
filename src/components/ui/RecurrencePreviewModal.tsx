import React from 'react';
import { RecurrenceConflictResult } from '../../types';
import { formatDateDisplay, formatTimeDisplay } from '../../lib/utils';
import { X, AlertTriangle, CheckCircle2, Calendar, ShieldAlert } from 'lucide-react';

interface RecurrencePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: RecurrenceConflictResult | null;
  onConfirmAvailableOnly: () => Promise<void>;
  onConfirmForceAll?: () => Promise<void>;
  isSubmitting?: boolean;
}

export const RecurrencePreviewModal: React.FC<RecurrencePreviewModalProps> = ({
  isOpen,
  onClose,
  result,
  onConfirmAvailableOnly,
  onConfirmForceAll,
  isSubmitting = false,
}) => {
  if (!isOpen || !result) return null;

  const hasConflicts = result.conflicts.length > 0;
  const availableCount = result.availableDates.length;
  const conflictCount = result.conflicts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${
              hasConflicts 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              {hasConflicts ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#f4f4f5] leading-tight">
                Recurrence Schedule Analysis
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                {result.totalRequested} total requested sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-[#18181b] border border-emerald-500/30 rounded-xl">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Available Slots
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {availableCount}
              </span>
              <span className="text-[10px] text-[#a1a1aa]">Ready to book</span>
            </div>

            <div className={`p-3 bg-[#18181b] border rounded-xl ${
              conflictCount > 0 ? 'border-rose-500/40' : 'border-[#27272a]'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                conflictCount > 0 ? 'text-rose-400' : 'text-[#71717a]'
              }`}>
                Slot Conflicts
              </span>
              <span className={`text-2xl font-bold font-mono mt-1 block ${
                conflictCount > 0 ? 'text-rose-400' : 'text-zinc-500'
              }`}>
                {conflictCount}
              </span>
              <span className="text-[10px] text-[#a1a1aa]">Already occupied</span>
            </div>
          </div>

          {/* Conflict Breakdown */}
          {hasConflicts && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <ShieldAlert className="w-4 h-4" />
                <span>Conflicting Sessions ({conflictCount})</span>
              </div>
              <p className="text-[#a1a1aa] text-[11px]">
                The following dates have existing bookings on this facility during the requested time:
              </p>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {result.conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#f4f4f5] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-rose-400" />
                        <span>{formatDateDisplay(c.date)}</span>
                      </div>
                      <div className="text-[10px] text-[#a1a1aa] mt-0.5">
                        Requested: {c.startTime} - {c.endTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                        Booked: {c.conflictingBooking.customer?.name || 'Customer'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Slots Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[#a1a1aa] font-semibold">
              <span>Available Session Dates ({availableCount})</span>
            </div>
            <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-lg max-h-32 overflow-y-auto text-[11px] font-mono text-zinc-300 flex flex-wrap gap-1.5">
              {result.availableDates.map((d, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-[#27272a] text-emerald-400 border border-emerald-500/20">
                  {formatDateDisplay(d)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold text-xs transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {hasConflicts && onConfirmForceAll && (
              <button
                type="button"
                onClick={onConfirmForceAll}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all disabled:opacity-50"
              >
                Force All ({result.totalRequested})
              </button>
            )}

            <button
              type="button"
              onClick={onConfirmAvailableOnly}
              disabled={isSubmitting || availableCount === 0}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Create Available Only ({availableCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
