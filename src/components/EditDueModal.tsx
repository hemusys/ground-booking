import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { formatCurrency } from '../lib/utils';
import { updateBookingPendingBalance } from '../lib/api';
import { X, Check, AlertTriangle, ShieldAlert } from 'lucide-react';

interface EditDueModalProps {
  isOpen: boolean;
  booking: Booking | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const EditDueModal: React.FC<EditDueModalProps> = ({
  isOpen,
  booking,
  onClose,
  onSuccess,
}) => {
  const [dueAmount, setDueAmount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [allowDueOverride, setAllowDueOverride] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setDueAmount(booking.pending_amount || 0);
      setAdjustmentReason(booking.pending_adjustment_reason || '');
      setAllowDueOverride(Boolean(booking.total_amount && (booking.pending_amount || 0) > booking.total_amount));
      setError(null);
    }
  }, [booking, isOpen]);

  if (!isOpen || !booking) return null;

  const naturalCalculatedDue = Math.max(0, booking.total_amount - (booking.total_paid || 0));
  const isDueChanged = dueAmount !== naturalCalculatedDue;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (dueAmount < 0) {
      setError('Due amount cannot be negative.');
      return;
    }

    if (!allowDueOverride && dueAmount > booking.total_amount) {
      setError('Due amount cannot exceed total booking fee without explicit override.');
      return;
    }

    if (isDueChanged && !adjustmentReason.trim()) {
      setError('Adjustment reason is required when due differs from calculated balance.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateBookingPendingBalance(
        booking.id,
        dueAmount,
        isDueChanged ? adjustmentReason.trim() : undefined
      );
      await onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update due amount.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-sm bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#f4f4f5] leading-none">
              Edit Due Amount
            </h3>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              {booking.customer?.name} • {booking.facility?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Reference Info */}
          <div className="p-2.5 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-between text-xs">
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase font-bold">Total Fee</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(booking.total_amount)}</span>
            </div>
            <div>
              <span className="text-[#a1a1aa] block text-[10px] uppercase font-bold">Paid So Far</span>
              <span className="font-mono font-bold text-[#f4f4f5]">{formatCurrency(booking.total_paid || 0)}</span>
            </div>
            <div className="text-right">
              <span className="text-[#a1a1aa] block text-[10px] uppercase font-bold">Calculated Due</span>
              <span className="font-mono font-bold text-amber-400">{formatCurrency(naturalCalculatedDue)}</span>
            </div>
          </div>

          {/* Due Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-amber-400 mb-1">
              New Due Amount (₹) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={dueAmount}
              onChange={(e) => setDueAmount(Number(e.target.value))}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-base font-mono font-bold text-amber-400 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Excess Due Override Toggle */}
          {dueAmount > booking.total_amount && (
            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Due exceeds total booking fee</span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#f4f4f5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowDueOverride}
                  onChange={(e) => setAllowDueOverride(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                <span>Allow excess due (late penalty / extra gear)</span>
              </label>
            </div>
          )}

          {/* Adjustment Reason */}
          {isDueChanged && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-amber-300">
                Adjustment Reason * (Required)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['Discount', 'Extra Charges', 'Floodlight Charges', 'Customer Credit', 'Penalty', 'Other'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setAdjustmentReason(reason === 'Other' ? '' : reason)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                      adjustmentReason === reason
                        ? 'bg-amber-500 text-zinc-950 font-bold border-amber-500'
                        : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:text-[#f4f4f5] hover:border-zinc-500'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Discount, Floodlight Charges, Extra Balls"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-amber-500"
              />
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold text-[#f4f4f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Save Immediately</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
