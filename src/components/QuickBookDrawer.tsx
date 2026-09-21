import React, { useState, useEffect } from 'react';
import { Facility, QuickBookFormData, RepeatType, Weekday, CustomerSummary, RecurrenceConflictResult } from '../types';
import { 
  findCustomerByPhone, 
  checkBookingConflict, 
  fetchCustomerSummaries, 
  generateRecurringDates, 
  analyzeRecurrenceConflicts,
  createRecurringBookings
} from '../lib/api';
import { formatCurrency, formatDateDisplay } from '../lib/utils';
import { createSafeBookingInterval, formatDurationLabel } from '../lib/time';
import { quickBookingSchema } from '../lib/schemas';
import { TimeSlotSelect } from './ui/TimeSlotSelect';
import { RecurrencePreviewModal } from './ui/RecurrencePreviewModal';
import { useUIStore } from '../stores/useUIStore';
import { 
  X, 
  AlertTriangle, 
  UserCheck, 
  MessageSquare, 
  Clock, 
  Edit3, 
  ShieldAlert, 
  CreditCard,
  Repeat,
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { format, addWeeks, parseISO } from 'date-fns';

interface QuickBookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: Facility[];
  initialFacilityId?: string;
  initialDate?: string;
  initialTime?: string;
  customerPhone?: string;
  customerName?: string;
  onSuccess: (formData: QuickBookFormData, openWhatsApp: boolean) => Promise<void>;
}

const ALL_WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'MON', label: 'Mon' },
  { key: 'TUE', label: 'Tue' },
  { key: 'WED', label: 'Wed' },
  { key: 'THU', label: 'Thu' },
  { key: 'FRI', label: 'Fri' },
  { key: 'SAT', label: 'Sat' },
  { key: 'SUN', label: 'Sun' },
];

export const QuickBookDrawer: React.FC<QuickBookDrawerProps> = ({
  isOpen,
  onClose,
  facilities,
  initialFacilityId,
  initialDate,
  initialTime,
  customerPhone: initPhone,
  customerName: initName,
  onSuccess,
}) => {
  const [facilityId, setFacilityId] = useState<string>('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('08:30');

  // Customer State
  const [phone, setPhone] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [existingCustomer, setExistingCustomer] = useState<CustomerSummary | null>(null);
  const [allowBlacklistOverride, setAllowBlacklistOverride] = useState<boolean>(false);
  const [quickCustomers, setQuickCustomers] = useState<CustomerSummary[]>([]);
  const { showToast } = useUIStore();

  // Recurring Bookings State (Priority 1)
  const [repeatType, setRepeatType] = useState<RepeatType>('NONE');
  const [repeatEndDate, setRepeatEndDate] = useState<string>(format(addWeeks(new Date(), 4), 'yyyy-MM-dd'));
  const [repeatWeekdays, setRepeatWeekdays] = useState<Weekday[]>(['MON', 'WED', 'FRI']);
  const [recurrenceConflictResult, setRecurrenceConflictResult] = useState<RecurrenceConflictResult | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState<boolean>(false);

  // Financials
  const [totalAmount, setTotalAmount] = useState<number>(1250);
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [customPendingAmount, setCustomPendingAmount] = useState<number>(1250);
  const [isPendingManuallyEdited, setIsPendingManuallyEdited] = useState<boolean>(false);
  const [pendingAdjustmentReason, setPendingAdjustmentReason] = useState<string>('');
  const [allowDueOverride, setAllowDueOverride] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');
  const [notes, setNotes] = useState<string>('');

  // Validation & Loading
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 1. Initialize form when opened
  useEffect(() => {
    if (!isOpen) return;

    if (initialFacilityId && facilities.some(f => f.id === initialFacilityId)) {
      setFacilityId(initialFacilityId);
    } else if (facilities.length > 0) {
      setFacilityId(facilities[0].id);
    }
    if (initialDate) {
      setDate(initialDate);
      setRepeatEndDate(format(addWeeks(parseISO(initialDate), 4), 'yyyy-MM-dd'));
    }
    if (initialTime) {
      setStartTime(initialTime);
      const [h, m] = initialTime.split(':').map(Number);
      const endH = (h + 2) % 24;
      const endM = (m + 30) % 60;
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    }
    if (initPhone) setPhone(initPhone);
    if (initName) setName(initName);

    setRepeatType('NONE');
    setRecurrenceConflictResult(null);
    setIsRecurrenceModalOpen(false);
    setAllowBlacklistOverride(false);
    setConflictError(null);
    setValidationErrors({});
    setIsPendingManuallyEdited(false);
    setPendingAdjustmentReason('');
    setAllowDueOverride(false);

    fetchCustomerSummaries()
      .then(summaries => {
        setQuickCustomers(summaries.slice(0, 4));
      })
      .catch(() => {});
  }, [isOpen, initialFacilityId, initialDate, initialTime, initPhone, initName]);

  // 2. Auto-calculate duration & total fee when start_time or end_time changes
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinsTotal = sh * 60 + sm;
  const endMinsTotal = eh * 60 + em;
  const isEndTimeInvalid = endMinsTotal <= startMinsTotal;
  const calculatedDurationMins = isEndTimeInvalid ? 0 : endMinsTotal - startMinsTotal;

  const currentFacilityRate = facilities.find(f => f.id === facilityId)?.hourly_rate || 0;

  useEffect(() => {
    if (!isOpen) return;
    if (currentFacilityRate > 0 && calculatedDurationMins > 0) {
      const hours = calculatedDurationMins / 60;
      const computedFee = Math.round(currentFacilityRate * hours);
      setTotalAmount(computedFee);
      if (!isPendingManuallyEdited) {
        setCustomPendingAmount(Math.max(0, computedFee - advancePaid));
      }
    }
  }, [isOpen, facilityId, currentFacilityRate, calculatedDurationMins, advancePaid, isPendingManuallyEdited]);

  // 3. Keep pending balance synchronized if not manually edited
  useEffect(() => {
    if (!isOpen) return;
    if (!isPendingManuallyEdited) {
      setCustomPendingAmount(Math.max(0, totalAmount - advancePaid));
    }
  }, [isOpen, totalAmount, advancePaid, isPendingManuallyEdited]);

  // 4. Phone substring auto-lookup for customer context & blacklist detection (Priority 3)
  useEffect(() => {
    if (!isOpen) return;
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 3) {
      const timer = setTimeout(async () => {
        const summaries = await fetchCustomerSummaries(cleanPhone);
        const match = summaries.find(c => c.phone.replace(/\D/g, '').includes(cleanPhone));
        if (match) {
          setName(match.name);
          setTeamName(match.team_name || '');
          setExistingCustomer(match);
        } else {
          setExistingCustomer(null);
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setExistingCustomer(null);
    }
  }, [phone, isOpen]);

  // 5. Single Conflict detection
  useEffect(() => {
    if (!isOpen || !facilityId || !date || !startTime || !endTime || isEndTimeInvalid || repeatType !== 'NONE') return;
    const { startIso, endIso } = createSafeBookingInterval(date, startTime, endTime);

    checkBookingConflict(facilityId, startIso, endIso).then(res => {
      if (res.hasConflict) {
        setConflictError('Facility already booked during this time.');
      } else {
        setConflictError(null);
      }
    });
  }, [isOpen, facilityId, date, startTime, endTime, isEndTimeInvalid, repeatType]);

  // Recurring calculation preview
  const recurringDates = repeatType !== 'NONE' 
    ? generateRecurringDates(date, repeatEndDate, repeatType, repeatWeekdays)
    : [date];

  const recurringSessionsCount = recurringDates.length;
  const recurringTotalExpectedRevenue = recurringSessionsCount * totalAmount;

  const toggleWeekday = (day: Weekday) => {
    if (repeatWeekdays.includes(day)) {
      if (repeatWeekdays.length > 1) {
        setRepeatWeekdays(repeatWeekdays.filter(d => d !== day));
      }
    } else {
      setRepeatWeekdays([...repeatWeekdays, day]);
    }
  };

  const naturalCalculatedDue = Math.max(0, totalAmount - advancePaid);
  const isDueOverridden = customPendingAmount !== naturalCalculatedDue;

  const handleSubmit = async (openWhatsApp: boolean) => {
    const cleanPhone = phone.replace(/\D/g, '');

    // Check customer blacklist block
    if (existingCustomer?.is_blacklisted && !allowBlacklistOverride) {
      alert(`Cannot book: ${existingCustomer.name} is blacklisted (${existingCustomer.blacklist_reason || 'Flagged'}). Check "Override Blacklist" if authorized.`);
      return;
    }

    const formDataPayload = {
      facility_id: facilityId,
      date,
      start_time: startTime,
      end_time: endTime,
      customer_phone: cleanPhone,
      customer_name: name.trim(),
      team_name: teamName.trim() || undefined,
      total_amount: Number(totalAmount),
      advance_paid: Number(advancePaid),
      custom_pending_amount: isPendingManuallyEdited ? Number(customPendingAmount) : null,
      pending_adjustment_reason: isDueOverridden ? pendingAdjustmentReason.trim() : null,
      allow_due_override: allowDueOverride,
      payment_method: paymentMethod,
      notes: notes.trim() || undefined,
      repeat_type: repeatType,
      repeat_end_date: repeatEndDate,
      repeat_weekdays: repeatWeekdays,
      allow_blacklist_override: allowBlacklistOverride,
    };

    // Zod Validation
    const validationResult = quickBookingSchema.safeParse(formDataPayload);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.issues.forEach(issue => {
        const fieldName = String(issue.path[0] || 'general');
        errors[fieldName] = issue.message;
      });
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    // If recurring booking with multiple sessions, run conflict analysis across ALL dates
    if (repeatType !== 'NONE' && recurringSessionsCount > 1) {
      setIsSubmitting(true);
      try {
        const conflictAnalysis = await analyzeRecurrenceConflicts(
          facilityId,
          recurringDates,
          startTime,
          endTime
        );
        setRecurrenceConflictResult(conflictAnalysis);
        if (conflictAnalysis.conflicts.length > 0) {
          setIsRecurrenceModalOpen(true);
          return;
        } else {
          // All available, proceed
          await createRecurringBookings(formDataPayload as QuickBookFormData, conflictAnalysis.availableDates);
          if (onSuccess) await onSuccess(formDataPayload as QuickBookFormData, openWhatsApp);
          showToast(`🏏 ${conflictAnalysis.availableDates.length} recurring sessions created successfully!`, 'success');
          onClose();
          return;
        }
      } catch (err: any) {
        showToast(err?.message || 'Failed to analyze recurring conflict.', 'error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Single booking flow
    if (conflictError) {
      showToast(conflictError, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSuccess(formDataPayload as QuickBookFormData, openWhatsApp);
      showToast('🏏 Booking confirmed successfully!', 'success');
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save booking.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAvailableOnlyFromModal = async () => {
    if (!recurrenceConflictResult) return;
    setIsSubmitting(true);
    try {
      const formDataPayload: QuickBookFormData = {
        facility_id: facilityId,
        date,
        start_time: startTime,
        end_time: endTime,
        customer_phone: phone.replace(/\D/g, ''),
        customer_name: name.trim(),
        team_name: teamName.trim() || undefined,
        total_amount: Number(totalAmount),
        advance_paid: Number(advancePaid),
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        repeat_type: repeatType,
        repeat_end_date: repeatEndDate,
        repeat_weekdays: repeatWeekdays,
      };

      await createRecurringBookings(formDataPayload, recurrenceConflictResult.availableDates);
      setIsRecurrenceModalOpen(false);
      onClose();
      await onSuccess(formDataPayload, false);
      showToast(`🏏 ${recurrenceConflictResult.availableDates.length} recurring sessions created!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create available bookings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md sm:max-w-lg bg-[#09090b] border-l border-[#27272a] h-full flex flex-col shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-base">
              ⚡
            </span>
            <div>
              <h2 className="text-base font-bold text-[#f4f4f5] leading-none">
                Quick Booking & Academy Series
              </h2>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                Single match or automated multi-session recurrence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1">
          {/* Conflict Warning */}
          {conflictError && repeatType === 'NONE' && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 flex items-center gap-2.5 text-xs font-semibold animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{conflictError}</span>
            </div>
          )}

          {/* Section 1: Facility & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Facility
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
                Start Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Section 2: Start Time & End Time */}
          <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <TimeSlotSelect
                  label="Start Time *"
                  value={startTime}
                  onChange={(val) => setStartTime(val)}
                  startHour={5}
                  endHour={23}
                  intervalMins={30}
                  errorMessage={validationErrors.start_time}
                />
              </div>

              <div>
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
            </div>

            {isEndTimeInvalid && (
              <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5 pt-0.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>End time must be after start time.</span>
              </div>
            )}

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
                  {calculatedDurationMins} mins total
                </span>
              </div>
            )}
          </div>

          {/* Priority 1: Recurring Booking Section */}
          <div className="bg-[#18181b] border border-purple-500/30 p-3.5 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-purple-400" />
                <span>Recurring Academy Booking</span>
              </label>
              <span className="text-[10px] text-purple-400/80 font-mono">Auto Multi-Booking</span>
            </div>

            {/* Repeat Type Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#09090b] border border-[#27272a] rounded-lg">
              {(['NONE', 'DAILY', 'WEEKLY', 'CUSTOM_WEEKDAYS'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRepeatType(type)}
                  className={`py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    repeatType === type
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                  }`}
                >
                  {type === 'NONE' ? 'Single' : type === 'DAILY' ? 'Daily' : type === 'WEEKLY' ? 'Weekly' : 'Weekdays'}
                </button>
              ))}
            </div>

            {repeatType !== 'NONE' && (
              <div className="space-y-3 pt-1 animate-in fade-in">
                {/* Custom Weekdays Selector */}
                {repeatType === 'CUSTOM_WEEKDAYS' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1.5">
                      Select Repeating Days:
                    </label>
                    <div className="grid grid-cols-7 gap-1">
                      {ALL_WEEKDAYS.map(({ key, label }) => {
                        const isSelected = repeatWeekdays.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleWeekday(key)}
                            className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isSelected
                                ? 'bg-purple-500 text-white border-purple-400 shadow-xs'
                                : 'bg-[#09090b] text-[#71717a] border-[#27272a] hover:text-[#f4f4f5]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recurrence End Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                    Repeat Until Date:
                  </label>
                  <input
                    type="date"
                    min={date}
                    value={repeatEndDate}
                    onChange={(e) => setRepeatEndDate(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-purple-500 rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden"
                  />
                </div>

                {/* Live Preview Calculation */}
                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-500/30 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-purple-300 block">
                      Recurrence Summary
                    </span>
                    <span className="font-mono text-purple-200">
                      {recurringSessionsCount} sessions • Total: <strong className="text-emerald-400 font-bold">{formatCurrency(recurringTotalExpectedRevenue)}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/40">
                    Conflict checked
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Customer Lookup & Instant Customer 360 Card (Priority 3) */}
          <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#a1a1aa]">
                  Customer Phone *
                </label>
                {existingCustomer && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <UserCheck className="w-3 h-3" /> Auto-filled Existing
                  </span>
                )}
              </div>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm font-mono text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              />
              {validationErrors.customer_phone && (
                <span className="text-[10px] text-rose-400 mt-0.5 block">{validationErrors.customer_phone}</span>
              )}

              {/* Quick Customer Chips */}
              {quickCustomers.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[10px] text-[#71717a] font-bold tracking-wider uppercase block">
                    ⚡ Quick Select Regulars
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickCustomers.map((c) => {
                      const isSelected = phone === c.phone;
                      return (
                        <button
                          key={c.id || c.phone}
                          type="button"
                          onClick={() => {
                            setPhone(c.phone);
                            setName(c.name);
                            setTeamName(c.team_name || '');
                            setExistingCustomer(c);
                            setValidationErrors((prev) => {
                              const updated = { ...prev };
                              delete updated.customer_phone;
                              delete updated.customer_name;
                              return updated;
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                              : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                          }`}
                        >
                          <span className="text-emerald-400">👤</span>
                          <span className="font-semibold">{c.name}</span>
                          {c.team_name && (
                            <span className="text-[10px] text-[#71717a] font-normal">({c.team_name})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Instant Customer 360 Card */}
            {existingCustomer && (
              <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a] space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#f4f4f5] block">
                      {existingCustomer.name}
                    </span>
                    {existingCustomer.team_name && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        🏏 {existingCustomer.team_name}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa] font-mono">
                    {existingCustomer.booking_count} bookings
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#27272a]">
                  <div>
                    <span className="text-[#71717a] block text-[9px] uppercase">Lifetime Spend</span>
                    <span className="font-bold font-mono text-emerald-400">
                      {formatCurrency(existingCustomer.total_spent)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#71717a] block text-[9px] uppercase">Outstanding Due</span>
                    <span className={`font-bold font-mono ${
                      existingCustomer.total_pending > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {formatCurrency(existingCustomer.total_pending)}
                    </span>
                  </div>
                </div>

                {/* Overdue Warning Alert */}
                {existingCustomer.total_pending > 3000 ? (
                  <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-500/60 text-rose-300 text-[11px] flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Critical overdue: Owes {formatCurrency(existingCustomer.total_pending)}</span>
                  </div>
                ) : existingCustomer.total_pending > 0 ? (
                  <div className="p-1.5 rounded-lg bg-amber-950/30 border border-amber-500/40 text-amber-300 text-[10px] flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Customer has {formatCurrency(existingCustomer.total_pending)} unpaid balance.</span>
                  </div>
                ) : null}

                {/* Blacklist Warning */}
                {existingCustomer.is_blacklisted && (
                  <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500 text-rose-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>⚠️ Customer is Blacklisted</span>
                    </div>
                    <p className="text-[10px] text-rose-300">
                      Reason: {existingCustomer.blacklist_reason || 'Disciplinary / Non-payment'}
                    </p>
                    <label className="flex items-center gap-1.5 text-[11px] text-[#f4f4f5] pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowBlacklistOverride}
                        onChange={(e) => setAllowBlacklistOverride(e.target.checked)}
                        className="rounded accent-rose-500"
                      />
                      <span>Override Blacklist (Manager Approval)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
                {validationErrors.customer_name && (
                  <span className="text-[10px] text-rose-400 mt-0.5 block">{validationErrors.customer_name}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Team Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Strikers CC"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Financials & Editable Due */}
          <div className="bg-[#18181b] border border-[#27272a] p-3.5 rounded-xl space-y-3">
            <div className="p-3 rounded-lg bg-[#09090b] border border-[#27272a] grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-[#a1a1aa] block uppercase font-bold">Total / Match</span>
                <span className="text-sm font-bold font-mono-numeric text-emerald-400">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="border-x border-[#27272a]">
                <span className="text-[10px] text-[#a1a1aa] block uppercase font-bold">Advance</span>
                <span className="text-sm font-bold font-mono-numeric text-[#f4f4f5]">
                  {formatCurrency(advancePaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-amber-400 block uppercase font-bold">Due</span>
                <span className="text-sm font-bold font-mono-numeric text-amber-400">
                  {formatCurrency(customPendingAmount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Advance Paid Now (₹)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={advancePaid || ''}
                  placeholder="0"
                  onChange={(e) => setAdvancePaid(Number(e.target.value))}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-sm font-mono text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setAdvancePaid(totalAmount)}
                  className="px-2.5 py-1 rounded bg-[#27272a] text-[#f4f4f5] hover:bg-emerald-500/20 text-xs font-medium shrink-0"
                >
                  Full (₹{totalAmount})
                </button>
                <button
                  type="button"
                  onClick={() => setAdvancePaid(0)}
                  className="px-2 py-1 rounded bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] text-xs font-medium shrink-0"
                >
                  ₹0
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#27272a] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" />
                  Pending Balance / Due Amount
                </label>
                {isDueOverridden && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPendingManuallyEdited(false);
                      setCustomPendingAmount(naturalCalculatedDue);
                      setPendingAdjustmentReason('');
                    }}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Reset to Default (₹{naturalCalculatedDue})
                  </button>
                )}
              </div>

              <input
                type="number"
                min="0"
                value={customPendingAmount}
                onChange={(e) => {
                  setIsPendingManuallyEdited(true);
                  setCustomPendingAmount(Number(e.target.value));
                }}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg px-3 py-2 text-base font-bold font-mono text-amber-400 focus:outline-hidden"
              />

              {isDueOverridden && (
                <div className="pt-1 space-y-1.5">
                  <label className="block text-[11px] font-semibold text-amber-300">
                    Adjustment Reason *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Discount, Academy Credit, Floodlight Fee"
                    value={pendingAdjustmentReason}
                    onChange={(e) => setPendingAdjustmentReason(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#27272a]">
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['UPI', 'CASH', 'CARD'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      paymentMethod === method
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#09090b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
                    }`}
                  >
                    {method === 'UPI' ? '📱 UPI' : method === 'CASH' ? '💵 Cash' : '💳 Card'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
              Booking Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Weekend under-19 nets session"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#18181b] border-t border-[#27272a] sticky bottom-0 z-10 space-y-2">
          <button
            type="button"
            disabled={isSubmitting || (repeatType === 'NONE' && Boolean(conflictError)) || isEndTimeInvalid}
            onClick={() => handleSubmit(true)}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <MessageSquare className="w-4 h-4 fill-zinc-950" />
            <span>
              {repeatType !== 'NONE'
                ? `Analyze & Book ${recurringSessionsCount} Sessions ↵`
                : 'Confirm & Open WhatsApp ↵'}
            </span>
          </button>

          <button
            type="button"
            disabled={isSubmitting || (repeatType === 'NONE' && Boolean(conflictError)) || isEndTimeInvalid}
            onClick={() => handleSubmit(false)}
            className="w-full py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold text-xs transition-colors"
          >
            Confirm Booking Only
          </button>
        </div>
      </div>

      {/* Recurrence Analysis Modal */}
      {isRecurrenceModalOpen && recurrenceConflictResult && (
        <RecurrencePreviewModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          result={recurrenceConflictResult}
          onConfirmAvailableOnly={handleCreateAvailableOnlyFromModal}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};
