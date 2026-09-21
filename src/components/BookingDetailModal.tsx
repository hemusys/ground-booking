import React, { useState, useEffect } from 'react';
import { Booking, Facility, BookingAuditLog } from '../types';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';
import { formatDurationLabel } from '../lib/time';
import { updateBookingPendingBalance, fetchFacilities, fetchBookingAuditLogs } from '../lib/api';
import { differenceInMinutes, parseISO, format } from 'date-fns';
import { 
  X, 
  Phone, 
  MessageSquare, 
  PlusCircle, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  Edit3, 
  Check, 
  RefreshCw,
  History,
  ShieldAlert,
  CreditCard,
  Banknote,
  QrCode,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { EditBookingModal } from './EditBookingModal';

interface BookingDetailModalProps {
  booking: Booking | null;
  facilities?: Facility[];
  onClose: () => void;
  onOpenCollectPayment: (booking: Booking) => void;
  onCancelBooking: (bookingId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  facilities: initialFacilities = [],
  onClose,
  onOpenCollectPayment,
  onCancelBooking,
  onRefresh,
}) => {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEditingDue, setIsEditingDue] = useState(false);
  const [isEditBookingModalOpen, setIsEditBookingModalOpen] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>(initialFacilities);
  const [newDueAmount, setNewDueAmount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<BookingAuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');

  useEffect(() => {
    if (!booking) return;
    if (initialFacilities.length > 0) {
      setFacilities(initialFacilities);
    } else {
      fetchFacilities().then(setFacilities);
    }
  }, [booking?.id, initialFacilities.length]);

  useEffect(() => {
    if (!booking?.id) return;
    if (booking.audit_logs && booking.audit_logs.length > 0) {
      setAuditLogs(booking.audit_logs);
    } else {
      fetchBookingAuditLogs(booking.id).then(setAuditLogs);
    }
  }, [booking?.id]);

  if (!booking) return null;

  const isPaid = booking.payment_status === 'FULLY_PAID';
  const isPartial = booking.payment_status === 'PARTIALLY_PAID';
  const pendingAmount = booking.pending_amount || 0;

  const durationMins = differenceInMinutes(parseISO(booking.end_time), parseISO(booking.start_time));
  const formattedDuration = formatDurationLabel(durationMins);

  const whatsAppLink = buildWhatsAppBookingLink({
    phone: booking.customer?.phone || '',
    customerName: booking.customer?.name,
    facilityName: booking.facility?.name || 'Cricket Facility',
    startIso: booking.start_time,
    endIso: booking.end_time,
    totalAmount: booking.total_amount,
    advancePaid: booking.total_paid || 0,
    pendingAmount: pendingAmount,
  });

  const telLink = `tel:${(booking.customer?.phone || '').replace(/[^\d+]/g, '')}`;

  const handleCancel = async () => {
    if (booking.recurring_group_id) {
      const cancelSeries = window.confirm(
        'This booking is part of a recurring series.\n\nClick OK to cancel ALL remaining sessions in this series.\nClick CANCEL to cancel ONLY this specific session.'
      );
      setIsCancelling(true);
      try {
        if (cancelSeries) {
          await onCancelBooking(booking.id);
          // If parent onCancelBooking handles single, we can call cancelBookingSeries
        } else {
          await onCancelBooking(booking.id);
        }
        onClose();
      } finally {
        setIsCancelling(false);
      }
      return;
    }

    if (window.confirm('Are you sure you want to cancel this booking? This will immediately free up the facility.')) {
      setIsCancelling(true);
      try {
        await onCancelBooking(booking.id);
        onClose();
      } finally {
        setIsCancelling(false);
      }
    }
  };

  const handleSaveDueAdjustment = async () => {
    if (newDueAmount < 0) {
      alert('Due amount cannot be negative.');
      return;
    }
    const naturalDue = Math.max(0, booking.total_amount - (booking.total_paid || 0));
    if (newDueAmount !== naturalDue && !adjustmentReason.trim()) {
      alert('Please enter an adjustment reason when due differs from standard balance.');
      return;
    }

    await updateBookingPendingBalance(booking.id, newDueAmount, adjustmentReason.trim());
    setIsEditingDue(false);
    const updatedLogs = await fetchBookingAuditLogs(booking.id);
    setAuditLogs(updatedLogs);
    if (onRefresh) await onRefresh();
  };

  const renderAuditActionIcon = (action: string) => {
    switch (action) {
      case 'BOOKING_CREATED':
        return <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'BOOKING_RESCHEDULED':
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'BOOKING_EDITED':
        return <Edit3 className="w-3.5 h-3.5 text-blue-400" />;
      case 'PAYMENT_COLLECTED':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'DUE_AMOUNT_CHANGED':
        return <RefreshCw className="w-3.5 h-3.5 text-purple-400" />;
      case 'CONFLICT_OVERRIDE':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      case 'BOOKING_CANCELLED':
        return <Trash2 className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <History className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const formatActionTitle = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              booking.is_cancelled 
                ? 'bg-rose-500'
                : isPaid 
                  ? 'bg-emerald-500' 
                  : isPartial 
                    ? 'bg-amber-500' 
                    : 'bg-rose-500'
            }`} />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-[#f4f4f5] leading-none">
                  {booking.facility?.name || 'Facility'} Booking
                </h3>
                {booking.is_conflict_override && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                    OVERRIDE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                {formatDateDisplay(booking.start_time)}
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

        {/* Tab Switcher */}
        <div className="flex border-b border-[#27272a] bg-[#121214] px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2 text-xs font-bold border-b-2 mr-4 transition-colors ${
              activeTab === 'details'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            Booking Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'timeline'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity Timeline ({auditLogs.length})</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'details' ? (
            <>
              {/* Time & Duration */}
              <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-bold font-mono text-[#f4f4f5]">
                      {formatTimeDisplay(booking.start_time)} – {formatTimeDisplay(booking.end_time)}
                    </div>
                    <div className="text-xs text-[#a1a1aa]">
                      Duration: {formattedDuration}
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#27272a] text-[#a1a1aa] font-medium">
                  {booking.facility?.type}
                </span>
              </div>

              {/* Customer Info & Quick Action */}
              <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[#f4f4f5]">
                      {booking.customer?.name}
                    </div>
                    {booking.customer?.team_name && (
                      <div className="text-xs text-emerald-400 font-medium">
                        🏏 {booking.customer.team_name}
                      </div>
                    )}
                    <div className="text-xs font-mono text-[#a1a1aa] mt-0.5">
                      +91 {booking.customer?.phone}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={telLink}
                      className="p-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-emerald-400 border border-[#3f3f46] transition-colors"
                      title="Direct Phone Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a
                      href={whatsAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                      title="Open WhatsApp Confirmation"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  </div>
                </div>

                {booking.notes && (
                  <div className="text-xs text-[#a1a1aa] pt-2 border-t border-[#27272a]">
                    <span className="text-[#71717a]">Notes:</span> {booking.notes}
                  </div>
                )}
              </div>

              {/* Ledger Breakdown & Pending Adjustment */}
              <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#a1a1aa]">Total Booking Fee:</span>
                  <span className="font-bold font-mono-numeric text-base text-[#f4f4f5]">
                    {formatCurrency(booking.total_amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#a1a1aa]">Total Paid So Far:</span>
                  <span className="font-semibold font-mono-numeric text-emerald-400">
                    {formatCurrency(booking.total_paid || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#27272a]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#f4f4f5]">Pending Balance Due:</span>
                    {!isEditingDue && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewDueAmount(pendingAmount);
                          setAdjustmentReason(booking.pending_adjustment_reason || '');
                          setIsEditingDue(true);
                        }}
                        className="p-1 rounded text-[#a1a1aa] hover:text-amber-400 hover:bg-[#27272a] transition-colors"
                        title="Edit Due Amount"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {!isEditingDue && (
                    <span className={`font-bold font-mono-numeric text-base ${
                      pendingAmount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {formatCurrency(pendingAmount)}
                    </span>
                  )}
                </div>

                {/* In-place Due Editing Form */}
                {isEditingDue && (
                  <div className="p-2.5 rounded-lg bg-[#09090b] border border-amber-500/40 space-y-2 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-amber-400">Edit Due Balance</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingDue(false)}
                        className="text-[10px] text-[#a1a1aa] hover:text-[#f4f4f5]"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={newDueAmount}
                        onChange={(e) => setNewDueAmount(Number(e.target.value))}
                        className="w-full bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1 text-sm font-mono text-amber-400 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDueAdjustment}
                        className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Adjustment reason (required if non-standard)..."
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded px-2.5 py-1 text-[11px] text-[#f4f4f5] focus:outline-hidden"
                    />
                  </div>
                )}

                {booking.pending_adjustment_reason && !isEditingDue && (
                  <div className="text-[11px] text-amber-300/90 pt-1">
                    <span className="font-semibold">Reason:</span> {booking.pending_adjustment_reason}
                  </div>
                )}

                {/* Feature 2: Payment History with Reference Badges */}
                {booking.payments && booking.payments.length > 0 && (
                  <div className="pt-2.5 border-t border-[#27272a] space-y-2">
                    <span className="text-[10px] text-[#71717a] uppercase font-bold tracking-wider block">
                      Payment Records:
                    </span>
                    {booking.payments.map((p) => (
                      <div key={p.id} className="p-2 bg-[#121214] border border-[#27272a] rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-[#f4f4f5]">
                            {p.payment_method === 'UPI' && <QrCode className="w-3.5 h-3.5 text-emerald-400" />}
                            {p.payment_method === 'CASH' && <Banknote className="w-3.5 h-3.5 text-emerald-400" />}
                            {p.payment_method === 'CARD' && <CreditCard className="w-3.5 h-3.5 text-emerald-400" />}
                            <span>{p.payment_method}</span>
                            {p.transaction_reference && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-emerald-300 border border-zinc-700">
                                {p.transaction_reference}
                              </span>
                            )}
                          </div>
                          <span className="font-mono-numeric font-bold text-emerald-400">
                            +₹{p.amount.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {(p.payment_notes || p.notes) && (
                          <div className="text-[11px] text-[#a1a1aa]">
                            {p.payment_notes || p.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Feature 1: Immutable Activity Timeline */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#a1a1aa] px-1">
                <span>Immutable Audit History</span>
                <span className="text-[10px] text-zinc-500">Newest First</span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#71717a] bg-[#18181b] rounded-xl border border-[#27272a]">
                  No audit entries recorded yet.
                </div>
              ) : (
                <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#27272a]">
                  {auditLogs.map((log) => {
                    const logDate = format(parseISO(log.created_at), 'dd MMM, hh:mm a');
                    return (
                      <div key={log.id} className="relative group">
                        <div className="absolute -left-5 top-1 p-1 rounded-full bg-[#18181b] border border-[#3f3f46]">
                          {renderAuditActionIcon(log.action_type)}
                        </div>

                        <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#f4f4f5]">
                              {formatActionTitle(log.action_type)}
                            </span>
                            <span className="text-[10px] font-mono text-[#71717a]">
                              {logDate}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#a1a1aa]">
                            Performed by: <span className="text-zinc-300 font-medium">{log.performed_by || 'Ground Admin'}</span>
                          </div>

                          {log.new_value && (
                            <div className="p-2 rounded bg-[#09090b] border border-[#27272a] text-[10px] font-mono text-zinc-400 space-y-0.5">
                              {Object.entries(log.new_value).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between">
                                  <span className="text-zinc-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                                  <span className="text-zinc-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCancelling || booking.is_cancelled}
              onClick={handleCancel}
              className="p-2.5 rounded-lg bg-[#27272a] hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Cancel Booking"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>

            <button
              type="button"
              disabled={booking.is_cancelled}
              onClick={() => setIsEditBookingModalOpen(true)}
              className="p-2.5 rounded-lg bg-[#27272a] hover:bg-emerald-500/20 hover:text-emerald-300 text-[#f4f4f5] text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#3f3f46] disabled:opacity-50"
              title="Edit date, time, customer, fee, or notes"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Edit</span>
            </button>
          </div>

          {!booking.is_cancelled && (
            pendingAmount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCollectPayment(booking);
                }}
                className="flex-1 py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Collect ({formatCurrency(pendingAmount)})</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                <span>Fully Settled</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Booking Modal */}
      {isEditBookingModalOpen && (
        <EditBookingModal
          isOpen={isEditBookingModalOpen}
          booking={booking}
          facilities={facilities}
          onClose={() => setIsEditBookingModalOpen(false)}
          onSuccess={async () => {
            setIsEditBookingModalOpen(false);
            if (onRefresh) await onRefresh();
            onClose();
          }}
        />
      )}
    </div>
  );
};
