import React, { useState, useMemo } from 'react';
import { Booking, Facility, BookingStatusFilter, BookingSearchFilters } from '../types';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { formatDurationLabel } from '../lib/time';
import { filterBookings, cancelBooking, recordPayment } from '../lib/api';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { EditBookingModal } from '../components/EditBookingModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { useUIStore } from '../stores/useUIStore';
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface BookingsPageProps {
  bookings: Booking[];
  facilities: Facility[];
  refetch: () => Promise<void>;
}

export const BookingsPage: React.FC<BookingsPageProps> = ({
  bookings,
  facilities,
  refetch,
}) => {
  const { openQuickBook } = useUIStore();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>('ALL');
  const [facilityId, setFacilityId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Modal States
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<Booking | null>(null);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);

  // Filtered Bookings
  const filters: BookingSearchFilters = useMemo(() => ({
    searchQuery,
    statusFilter,
    facilityId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }), [searchQuery, statusFilter, facilityId, startDate, endDate]);

  const filteredBookings = useMemo(() => {
    return filterBookings(bookings, filters);
  }, [bookings, filters]);

  // Aggregate Metrics for current filtered view
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalPending = 0;

    filteredBookings.forEach((b) => {
      if (!b.is_cancelled) {
        totalRevenue += Number(b.total_amount || 0);
        totalCollected += Number(b.total_paid || 0);
        totalPending += Number(b.pending_amount || 0);
      }
    });

    return {
      count: filteredBookings.length,
      totalRevenue,
      totalCollected,
      totalPending,
    };
  }, [filteredBookings]);

  const handleCancel = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await refetch();
  };

  const statusFilterOptions: { value: BookingStatusFilter; label: string; count?: number }[] = [
    { value: 'ALL', label: 'All Bookings' },
    { value: 'TODAY', label: 'Today' },
    { value: 'TOMORROW', label: 'Tomorrow' },
    { value: 'UPCOMING', label: 'Upcoming' },
    { value: 'PAST', label: 'Past' },
    { value: 'PENDING_PAYMENT', label: 'Due / Unpaid' },
    { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
    { value: 'FULLY_PAID', label: 'Fully Settled' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setFacilityId('ALL');
    setStartDate('');
    setEndDate('');
  };

  const isFilterActive =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    facilityId !== 'ALL' ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-6">
      {/* Header & Search Bar */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#f4f4f5] leading-tight flex items-center gap-2">
              <span>Bookings Explorer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa] font-mono">
                {metrics.count} results
              </span>
            </h2>
            <p className="text-xs text-[#a1a1aa]">
              Search and filter across all cricket grounds, nets, and dues
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                showAdvancedFilters || isFilterActive
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#09090b] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {isFilterActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>

            <button
              onClick={() => openQuickBook({ date: format(new Date(), 'yyyy-MM-dd') })}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Booking</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, team name, facility, date (e.g. Rahul, 98765, Net 1, 20 Sep)..."
            className="w-full bg-[#09090b] border border-[#27272a] rounded-lg pl-9 pr-8 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] focus:outline-hidden focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#f4f4f5] p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                statusFilter === opt.value
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-xs'
                  : 'bg-[#09090b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters (Facility & Date Range) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-[#27272a] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-100">
            {/* Facility Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                Facility
              </label>
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              >
                <option value="ALL">All Facilities</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* End Date & Clear */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-[#a1a1aa]">
                  To Date
                </label>
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Aggregated Financial Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#27272a]">
          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Matches / Bookings</span>
            <span className="text-base font-bold font-mono text-[#f4f4f5]">
              {metrics.count}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Total Amount</span>
            <span className="text-base font-bold font-mono text-emerald-400">
              {formatCurrency(metrics.totalRevenue)}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-[#a1a1aa] uppercase font-bold block">Collected</span>
            <span className="text-base font-bold font-mono text-[#f4f4f5]">
              {formatCurrency(metrics.totalCollected)}
            </span>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] p-2.5 rounded-lg">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">Pending Due</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {formatCurrency(metrics.totalPending)}
            </span>
          </div>
        </div>
      </div>

      {/* Bookings List Cards */}
      <div className="space-y-3">
        {filteredBookings.length === 0 ? (
          <div className="text-center py-12 bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-3 text-xl">
              🔍
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">No Bookings Found</h3>
            <p className="text-xs text-[#a1a1aa] mt-1 max-w-sm mx-auto">
              No bookings matched your search query or filters. Try adjusting your search term or date range.
            </p>
            {isFilterActive && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 px-3 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-xs font-semibold text-emerald-400"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          filteredBookings.map((b) => {
            const isPaid = b.payment_status === 'FULLY_PAID';
            const isPartial = b.payment_status === 'PARTIALLY_PAID';
            const isCancelled = Boolean(b.is_cancelled);
            const pendingAmt = b.pending_amount || 0;

            const whatsAppLink = buildWhatsAppBookingLink({
              phone: b.customer?.phone || '',
              facilityName: b.facility?.name || 'Facility',
              startIso: b.start_time,
              endIso: b.end_time,
              totalAmount: b.total_amount,
              advancePaid: b.total_paid || 0,
              pendingAmount: pendingAmt,
            });

            return (
              <div
                key={b.id}
                className={`p-4 bg-[#18181b] border rounded-xl shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCancelled
                    ? 'border-rose-950 opacity-60 bg-zinc-950/40'
                    : b.is_conflict_override
                    ? 'border-amber-500/30 hover:border-amber-500/60'
                    : 'border-[#27272a] hover:border-zinc-500'
                }`}
              >
                {/* Left: Facility, Date, Time & Customer */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#27272a] text-xs font-bold text-[#f4f4f5]">
                      {b.facility?.name || 'Facility'}
                    </span>

                    <span className="text-xs font-mono font-semibold text-[#f4f4f5] flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                      {formatDateDisplay(b.start_time)}
                    </span>

                    <span className="text-xs font-mono text-[#a1a1aa] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#71717a]" />
                      {formatTimeDisplay(b.start_time)} – {formatTimeDisplay(b.end_time)}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCancelled
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : isPaid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isPartial
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isCancelled ? 'CANCELLED' : b.payment_status}
                    </span>

                    {b.is_conflict_override && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Force Override
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-sm font-bold text-[#f4f4f5]">
                      {b.customer?.name}
                    </span>
                    {b.customer?.team_name && (
                      <span className="text-xs text-emerald-400 font-medium">
                        • {b.customer.team_name}
                      </span>
                    )}
                    <span className="text-xs font-mono text-[#a1a1aa]">
                      +91 {b.customer?.phone}
                    </span>
                  </div>

                  {b.notes && (
                    <p className="text-[11px] text-[#a1a1aa] italic">
                      "{b.notes}"
                    </p>
                  )}
                </div>

                {/* Right: Financial Summary & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#27272a]">
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono-numeric text-[#f4f4f5]">
                      {formatCurrency(b.total_amount)}
                    </div>
                    {pendingAmt > 0 && !isCancelled ? (
                      <div className="text-[11px] font-bold font-mono-numeric text-amber-400">
                        Due: {formatCurrency(pendingAmt)}
                      </div>
                    ) : isPaid ? (
                      <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-0.5 justify-end">
                        <CheckCircle2 className="w-3 h-3" /> Settled
                      </div>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* WhatsApp Link */}
                    {!isCancelled && (
                      <a
                        href={whatsAppLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                        title="Open WhatsApp Confirmation"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Collect Payment */}
                    {pendingAmt > 0 && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => setSelectedBookingForPayment(b)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors"
                      >
                        Collect
                      </button>
                    )}

                    {/* Edit / Reschedule */}
                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => setSelectedBookingForEdit(b)}
                        className="p-1.5 rounded-lg bg-[#27272a] hover:bg-emerald-500/20 hover:text-emerald-300 text-[#a1a1aa] transition-colors"
                        title="Edit / Reschedule Booking"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedBookingForDetails(b)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold text-xs transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBookingForDetails && (
        <BookingDetailModal
          booking={selectedBookingForDetails}
          facilities={facilities}
          onClose={() => setSelectedBookingForDetails(null)}
          onOpenCollectPayment={(b) => {
            setSelectedBookingForDetails(null);
            setSelectedBookingForPayment(b);
          }}
          onCancelBooking={handleCancel}
          onRefresh={refetch}
        />
      )}

      {/* Edit / Reschedule Modal */}
      {selectedBookingForEdit && (
        <EditBookingModal
          isOpen={Boolean(selectedBookingForEdit)}
          booking={selectedBookingForEdit}
          facilities={facilities}
          onClose={() => setSelectedBookingForEdit(null)}
          onSuccess={async () => {
            setSelectedBookingForEdit(null);
            await refetch();
          }}
        />
      )}

      {/* Collect Payment Modal */}
      {selectedBookingForPayment && (
        <CollectPaymentModal
          booking={selectedBookingForPayment}
          onClose={() => setSelectedBookingForPayment(null)}
          onCollect={async (bookingId, amount, method, notes, transactionReference) => {
            await recordPayment(bookingId, amount, method, notes, transactionReference);
            await refetch();
            setSelectedBookingForPayment(null);
          }}
        />
      )}
    </div>
  );
};
