import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CustomerSummary, Booking } from '../types';
import { fetchCustomerById, toggleCustomerBlacklist, cancelBooking, recordPayment } from '../lib/api';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { 
  Users, 
  Phone, 
  MessageSquare, 
  ArrowLeft, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Plus, 
  DollarSign, 
  Slash, 
  Check 
} from 'lucide-react';

interface CustomerProfilePageProps {
  refetchAll?: () => Promise<void>;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({ refetchAll }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openQuickBook } = useUIStore();

  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState<boolean>(false);
  const [blacklistReason, setBlacklistReason] = useState<string>('');
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);
  const [activeBookingForPayment, setActiveBookingForPayment] = useState<Booking | null>(null);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchCustomerById(id);
      setCustomer(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleToggleBlacklist = async () => {
    if (!customer) return;
    const targetState = !customer.is_blacklisted;
    await toggleCustomerBlacklist(customer.id, targetState, blacklistReason.trim());
    setIsBlacklistModalOpen(false);
    setBlacklistReason('');
    await loadData();
    if (refetchAll) await refetchAll();
  };

  const handleCollectPayment = async (
    bookingId: string, 
    amount: number, 
    method: 'UPI' | 'CASH' | 'CARD', 
    notes?: string,
    transactionReference?: string
  ) => {
    await recordPayment(bookingId, amount, method, notes, transactionReference);
    await loadData();
    if (refetchAll) await refetchAll();
    setActiveBookingForPayment(null);
  };

  const handleCancelBooking = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await loadData();
    if (refetchAll) await refetchAll();
    setActiveBookingDetail(null);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#a1a1aa] space-y-2">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading customer profile...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
        <Users className="w-8 h-8 text-zinc-600 mx-auto" />
        <h3 className="text-base font-bold text-[#f4f4f5]">Customer Not Found</h3>
        <button
          onClick={() => navigate('/customers')}
          className="px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold"
        >
          Return to Customers
        </button>
      </div>
    );
  }

  const isCriticalDue = customer.total_pending > 3000;
  const isModerateDue = customer.total_pending > 0 && !isCriticalDue;

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-2 text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBlacklistModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              customer.is_blacklisted
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{customer.is_blacklisted ? 'Remove Blacklist' : 'Blacklist Customer'}</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickBook({ customerPhone: customer.phone, customerName: customer.name })}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Booking</span>
          </button>
        </div>
      </div>

      {/* Blacklist Alert Banner */}
      {customer.is_blacklisted && (
        <div className="p-4 bg-rose-950/30 border border-rose-500/50 rounded-2xl flex items-start gap-3 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-400">
              ⚠️ Customer is Blacklisted
            </h4>
            <p className="text-xs text-rose-300/90 mt-0.5">
              Reason: {customer.blacklist_reason || 'Flagged by ground manager due to payment/discipline history.'}
            </p>
          </div>
        </div>
      )}

      {/* Overdue Warnings */}
      {isCriticalDue && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/60 rounded-2xl flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <h4 className="text-sm font-bold text-rose-400">
              🚨 Critical Overdue Balance ({formatCurrency(customer.total_pending)})
            </h4>
            <p className="text-xs text-rose-300/90 mt-0.5">
              This customer owes over ₹3,000 across active sessions. Settle payments before granting pitch access.
            </p>
          </div>
        </div>
      )}

      {isModerateDue && (
        <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            Pending Balance: <span className="font-bold font-mono text-amber-400">{formatCurrency(customer.total_pending)}</span> outstanding.
          </p>
        </div>
      )}

      {/* Customer Header Card */}
      <div className="p-5 bg-[#18181b] border border-[#27272a] rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-[#f4f4f5]">
              {customer.name}
            </h2>
            {customer.team_name && (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                🏏 {customer.team_name}
              </span>
            )}
            {customer.is_blacklisted && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                BLACKLISTED
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#a1a1aa]">
            <span className="font-mono text-zinc-300">+91 {customer.phone}</span>
            <span>•</span>
            <span>Reliability: <strong className="text-emerald-400">{customer.reliability_score || 100}%</strong></span>
          </div>

          {customer.notes && (
            <p className="text-xs text-[#71717a] pt-1">
              Notes: {customer.notes}
            </p>
          )}
        </div>

        {/* Quick Communication Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`tel:${customer.phone}`}
            className="px-3.5 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span>Call</span>
          </a>
          <a
            href={`https://wa.me/91${customer.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <MessageSquare className="w-4 h-4 fill-zinc-950" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Customer 360 Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
          <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
            Total Bookings
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-[#f4f4f5] mt-1 block">
            {customer.booking_count}
          </span>
          <span className="text-[10px] text-[#71717a]">Lifetime sessions</span>
        </div>

        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
          <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
            Lifetime Revenue
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 block">
            {formatCurrency(customer.total_spent + customer.total_pending)}
          </span>
          <span className="text-[10px] text-[#71717a]">Gross value booked</span>
        </div>

        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
          <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
            Total Paid
          </span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 block">
            {formatCurrency(customer.total_spent)}
          </span>
          <span className="text-[10px] text-emerald-500/80">Collected in cash/UPI</span>
        </div>

        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
          <span className={`text-[10px] uppercase font-bold tracking-wider block ${
            customer.total_pending > 0 ? 'text-amber-400' : 'text-[#71717a]'
          }`}>
            Current Outstanding
          </span>
          <span className={`text-xl sm:text-2xl font-bold font-mono mt-1 block ${
            customer.total_pending > 0 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {formatCurrency(customer.total_pending)}
          </span>
          <span className="text-[10px] text-[#71717a]">
            {customer.total_pending > 0 ? 'Due across active matches' : 'Zero debt'}
          </span>
        </div>
      </div>

      {/* Booking History Timeline */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-[#f4f4f5] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Booking History Timeline ({customer.bookings.length})</span>
          </h3>
          <span className="text-xs text-[#71717a]">Sorted by session date</span>
        </div>

        {customer.bookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#71717a]">
            No bookings recorded for this customer yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {customer.bookings.map((b) => {
              const isPaid = b.payment_status === 'FULLY_PAID';
              const isPartial = b.payment_status === 'PARTIALLY_PAID';

              return (
                <div
                  key={b.id}
                  onClick={() => setActiveBookingDetail(b)}
                  className="p-3.5 bg-[#121214] border border-[#27272a] hover:border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#f4f4f5]">
                        {b.facility?.name || 'Facility'}
                      </span>
                      {b.recurring_group_id && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 text-[10px] font-semibold border border-purple-500/20">
                          🔁 Series
                        </span>
                      )}
                      {b.is_cancelled && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                          CANCELLED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#a1a1aa]">
                      <span className="font-mono">{formatDateDisplay(b.start_time)}</span>
                      <span>•</span>
                      <span className="font-mono">{formatTimeDisplay(b.start_time)} – {formatTimeDisplay(b.end_time)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-[#27272a] pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-bold font-mono text-[#f4f4f5]">
                        {formatCurrency(b.total_amount)}
                      </div>
                      <span className={`text-[10px] font-semibold ${
                        b.is_cancelled
                          ? 'text-rose-400'
                          : isPaid
                          ? 'text-emerald-400'
                          : isPartial
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {b.is_cancelled ? 'Cancelled' : isPaid ? 'Fully Paid ✅' : `Due: ₹${b.pending_amount}`}
                      </span>
                    </div>

                    {!b.is_cancelled && (b.pending_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBookingForPayment(b);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Collect</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Blacklist Modal */}
      {isBlacklistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-md bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-[#f4f4f5] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>{customer.is_blacklisted ? 'Remove Blacklist Status' : 'Blacklist Customer'}</span>
            </h3>

            {!customer.is_blacklisted && (
              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                  Reason for Blacklisting (Required)
                </label>
                <textarea
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  placeholder="e.g. Repeated non-payment of match dues / unnotified cancellations"
                  rows={3}
                  className="w-full bg-[#18181b] border border-[#27272a] focus:border-rose-500 rounded-lg p-2.5 text-xs text-[#f4f4f5] focus:outline-hidden"
                />
              </div>
            )}

            {customer.is_blacklisted && (
              <p className="text-xs text-[#a1a1aa]">
                Are you sure you want to remove <strong className="text-zinc-200">{customer.name}</strong> from the blacklist? They will be allowed to book freely.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBlacklistModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#27272a] text-[#f4f4f5] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleBlacklist}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  customer.is_blacklisted
                    ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }`}
              >
                {customer.is_blacklisted ? 'Confirm Removal' : 'Confirm Blacklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      <CollectPaymentModal
        booking={activeBookingForPayment}
        onClose={() => setActiveBookingForPayment(null)}
        onCollect={handleCollectPayment}
      />

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={activeBookingDetail}
        onClose={() => setActiveBookingDetail(null)}
        onOpenCollectPayment={(b) => setActiveBookingForPayment(b)}
        onCancelBooking={handleCancelBooking}
        onRefresh={loadData}
      />
    </div>
  );
};
