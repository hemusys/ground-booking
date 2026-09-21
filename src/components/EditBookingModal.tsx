import React, { useState, useEffect } from 'react';
import { Booking, Facility, EditBookingFormData } from '../types';
import { formatCurrency, formatDateDisplay } from '../lib/utils';
import { formatDurationLabel, createSafeBookingInterval } from '../lib/time';
import { checkBookingConflict, updateBooking } from '../lib/api';
import { TimeSlotSelect } from './ui/TimeSlotSelect';
import { ConflictModal } from './ui/ConflictModal';
import { quickBookingSchema } from '../lib/schemas';
import {
  X,
  AlertTriangle,
  Clock,
  Edit3,
  ShieldAlert,
  Check,
  Calendar as CalendarIcon,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface EditBookingModalProps {
  isOpen: boolean;
  booking: Booking | null;
  facilities: Facility[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  isOpen,
  booking,
  facilities,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !booking) return null;

  const bStart = parseISO(booking.start_time);
  const bEnd = parseISO(booking.end_time);

  const [facilityId, setFacilityId] = useState<string>(booking.facility_id);
  const [date, setDate] = useState<string>(format(bStart, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>(format(bStart, 'HH:mm'));
  const [endTime, setEndTime] = useState<string>(format(bEnd, 'HH:mm'));

  // Customer State
  const [name, setName] = useState<string>(booking.customer?.name || '');
  const [phone, setPhone] = useState<string>(booking.customer?.phone || '');
  const [teamName, setTeamName] = useState<string>(booking.customer?.team_name || '');

  // Financials
  const [totalAmount, setTotalAmount] = useState<number>(booking.total_amount);
  const [customPendingAmount, setCustomPendingAmount] = useState<number>(
    booking.custom_pending_amount !== null && booking.custom_pending_amount !== undefined
      ? booking.custom_pending_amount
      : (booking.pending_amount || 0)
  );
  const [pendingAdjustmentReason, setPendingAdjustmentReason] = useState<string>(
    booking.pending_adjustment_reason || ''
  );
  const [allowDueOverride, setAllowDueOverride] = useState<boolean>(
    Boolean(booking.allow_due_override)
  );
  const [notes, setNotes] = useState<string>(booking.notes || '');
  const [editSeriesMode, setEditSeriesMode] = useState<'THIS_ONLY' | 'FUTURE_SERIES'>('THIS_ONLY');

  // Conflict & Validation States
  const [conflictingBooking, setConflictingBooking] = useState<Booking | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time & Duration Calculation
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinsTotal = sh * 60 + sm;
  const endMinsTotal = eh * 60 + em;
  const isEndTimeInvalid = endMinsTotal <= startMinsTotal;
  const calculatedDurationMins = isEndTimeInvalid ? 0 : endMinsTotal - startMinsTotal;

  const totalPaid = booking.total_paid || 0;
  const naturalCalculatedDue = Math.max(0, totalAmount - totalPaid);
  const isDueOverridden = customPendingAmount !== naturalCalculatedDue;

  const selectedFacility = facilities.find((f) => f.id === facilityId);

  const handleSave = async (forceOverride: boolean = false) => {
    setValidationErrors({});
    const cleanPhone = phone.replace(/\D/g, '');

    const payload: EditBookingFormData = {
      booking_id: booking.id,
      facility_id: facilityId,
      date,
      start_time: startTime,
      end_time: endTime,
      customer_phone: cleanPhone,
      customer_name: name.trim(),
      team_name: teamName.trim() || undefined,
      total_amount: Number(totalAmount),
      custom_pending_amount: isDueOverridden ? Number(customPendingAmount) : null,
      pending_adjustment_reason: isDueOverridden ? pendingAdjustmentReason.trim() : null,
      allow_due_override: allowDueOverride,
      is_conflict_override: forceOverride || Boolean(booking.is_conflict_override),
      notes: notes.trim() || undefined,
      edit_series_mode: editSeriesMode,
    };

    // Client-side validations
    if (isEndTimeInvalid) {
      setValidationErrors({ end_time: 'End time must be after start time' });
      return;
    }

    if (!name.trim()) {
      setValidationErrors({ customer_name: 'Customer name is required' });
      return;
    }

    if (cleanPhone.length < 10) {
      setValidationErrors({ customer_phone: 'Valid 10-digit phone number is required' });
      return;
    }

    if (customPendingAmount < 0) {
      setValidationErrors({ custom_pending_amount: 'Due amount cannot be negative' });
      return;
    }

    if (customPendingAmount > totalAmount && !allowDueOverride) {
      setValidationErrors({
        custom_pending_amount: 'Due amount exceeds total fee. Enable override if intentional.',
      });
      return;
    }

    if (isDueOverridden && !pendingAdjustmentReason.trim()) {
      setValidationErrors({
        pending_adjustment_reason: 'Adjustment reason is required when due differs from standard balance',
      });
      return;
    }

    // Check Conflict if not forcing override
    if (!forceOverride) {
      const { startIso, endIso } = createSafeBookingInterval(date, startTime, endTime);
      const conflictRes = await checkBookingConflict(facilityId, startIso, endIso, booking.id);
      if (conflictRes.hasConflict && conflictRes.conflictingBooking) {
        setConflictingBooking(conflictRes.conflictingBooking);
        setIsConflictModalOpen(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateBooking(payload);
      setToastMessage('Booking rescheduled & updated successfully!');
      setTimeout(async () => {
        await onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      alert(err?.message || 'Failed to update booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
        <div 
          className="w-full max-w-lg bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <RefreshCw className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#f4f4f5] leading-none">
                  Edit & Reschedule Booking
                </h3>
                <p className="text-[11px] text-[#a1a1aa] mt-0.5 font-mono">
                  ID: {booking.id} • Created {formatDateDisplay(booking.created_at)}
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
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {toastMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-bounce">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* Recurring Series Edit Scope Option */}
            {booking.recurring_group_id && (
              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span>🔁</span> Part of Recurring Series
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">Multi-session</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSeriesMode('THIS_ONLY')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                      editSeriesMode === 'THIS_ONLY'
                        ? 'bg-purple-600 text-white border-purple-400 font-bold'
                        : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    Edit This Booking Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSeriesMode('FUTURE_SERIES')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                      editSeriesMode === 'FUTURE_SERIES'
                        ? 'bg-purple-600 text-white border-purple-400 font-bold'
                        : 'bg-[#18181b] text-[#a1a1aa] border-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    Edit All Future In Series
                  </button>
                </div>
              </div>
            )}

            {/* Section 1: Facility & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Facility *
                </label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                >
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} (₹{fac.hourly_rate}/h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Section 2: Time Slots (Searchable Selects) */}
            <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <TimeSlotSelect
                  label="Start Time *"
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                  startHour={5}
                  endHour={23}
                  intervalMins={30}
                  errorMessage={validationErrors.start_time}
                />
                <TimeSlotSelect
                  label="End Time *"
                  value={endTime}
                  onChange={(val) => setEndTime(val)}
                  isInvalid={isEndTimeInvalid}
                  startHour={5}
                  endHour={23}
                  intervalMins={30}
                  errorMessage={validationErrors.end_time}
                />
              </div>

              {/* Validation warning if end time earlier than start time */}
              {isEndTimeInvalid && (
                <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>End time must be after start time.</span>
                </div>
              )}

              {/* DURATION CARD */}
              {!isEndTimeInvalid && (
                <div className="p-2.5 rounded-lg bg-[#09090b] border border-[#27272a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🕒</span>
                    <div>
                      <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block leading-none">
                        Duration
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-400">
                        {formatDurationLabel(calculatedDurationMins)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-[#71717a] font-mono">
                    {calculatedDurationMins} minutes total
                  </span>
                </div>
              )}
            </div>

            {/* Section 3: Customer Details */}
            <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Customer Phone *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm font-mono text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
                {validationErrors.customer_phone && (
                  <span className="text-[10px] text-rose-400 block mt-0.5">{validationErrors.customer_phone}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                  />
                  {validationErrors.customer_name && (
                    <span className="text-[10px] text-rose-400 block mt-0.5">{validationErrors.customer_name}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                    Team Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Financial Summary & Editable Balance */}
            <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-3">
              <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-[#a1a1aa] block uppercase font-bold">Total Fee</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="border-x border-[#27272a]">
                  <span className="text-[10px] text-[#a1a1aa] block uppercase font-bold">Paid So Far</span>
                  <span className="text-sm font-bold font-mono text-[#f4f4f5]">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 block uppercase font-bold">Due Amount</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {formatCurrency(customPendingAmount)}
                  </span>
                </div>
              </div>

              {/* Total Fee Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#a1a1aa]">
                    Total Booking Fee (₹) *
                  </label>
                  {selectedFacility && (
                    <button
                      type="button"
                      onClick={() => {
                        const hours = calculatedDurationMins / 60;
                        const computed = Math.round(selectedFacility.hourly_rate * hours);
                        setTotalAmount(computed);
                        setCustomPendingAmount(Math.max(0, computed - totalPaid));
                      }}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Auto Rate ({calculatedDurationMins / 60}h × ₹{selectedFacility.hourly_rate})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm font-mono text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Editable Due Amount */}
              <div className="pt-2 border-t border-[#27272a] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" />
                    Pending Balance / Due Amount (₹)
                  </label>
                  {isDueOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPendingAmount(naturalCalculatedDue);
                        setPendingAdjustmentReason('');
                      }}
                      className="text-[10px] text-emerald-400 hover:underline"
                    >
                      Reset to Standard (₹{naturalCalculatedDue})
                    </button>
                  )}
                </div>

                <input
                  type="number"
                  min="0"
                  value={customPendingAmount}
                  onChange={(e) => setCustomPendingAmount(Number(e.target.value))}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-amber-400 focus:outline-hidden focus:border-amber-500"
                />
                {validationErrors.custom_pending_amount && (
                  <span className="text-[10px] text-rose-400 block">{validationErrors.custom_pending_amount}</span>
                )}

                {/* Excess Due Override Toggle */}
                {customPendingAmount > totalAmount && (
                  <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                    <label className="flex items-center gap-1.5 text-[11px] text-[#f4f4f5] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowDueOverride}
                        onChange={(e) => setAllowDueOverride(e.target.checked)}
                        className="rounded accent-emerald-500"
                      />
                      <span>Allow due to exceed total fee (penalty / surcharge)</span>
                    </label>
                  </div>
                )}

                {/* Adjustment Reason */}
                {isDueOverridden && (
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-semibold text-amber-300">
                      Adjustment Reason * (Required)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Rescheduled', 'Discount', 'Extra Charges', 'Floodlight Charges', 'Customer Credit', 'Other'].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setPendingAdjustmentReason(reason === 'Other' ? '' : reason)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                            pendingAdjustmentReason === reason
                              ? 'bg-amber-500 text-zinc-950 font-bold border-amber-500'
                              : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a] hover:text-[#f4f4f5]'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Rescheduled match, Floodlights added"
                      value={pendingAdjustmentReason}
                      onChange={(e) => setPendingAdjustmentReason(e.target.value)}
                      className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-amber-500"
                    />
                    {validationErrors.pending_adjustment_reason && (
                      <span className="text-[10px] text-rose-400 block">{validationErrors.pending_adjustment_reason}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Booking Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Match ball requested, shifted to evening"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[#18181b] border-t border-[#27272a] flex items-center justify-end gap-2.5 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || isEndTimeInvalid}
              onClick={() => handleSave(false)}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSubmitting ? 'Saving Changes...' : 'Save & Update Booking'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conflict Modal */}
      {isConflictModalOpen && conflictingBooking && (
        <ConflictModal
          isOpen={isConflictModalOpen}
          conflictingBooking={conflictingBooking}
          facility={selectedFacility || null}
          requestedDate={date}
          requestedStartTime={startTime}
          requestedEndTime={endTime}
          onCancel={() => setIsConflictModalOpen(false)}
          onForceBook={() => {
            setIsConflictModalOpen(false);
            handleSave(true); // Force override
          }}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
};
