import React from 'react';
import { Facility, Booking, QuickBookFormData } from '../types';
import { TimelineGrid } from '../components/TimelineGrid';
import { MobileRunSheet } from '../components/MobileRunSheet';
import { QuickBookDrawer } from '../components/QuickBookDrawer';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { FacilityManagerModal } from '../components/FacilityManagerModal';
import { useUIStore } from '../stores/useUIStore';
import { createQuickBooking, cancelBooking, recordPayment, saveFacility, deleteFacility } from '../lib/api';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';
import { formatDateDisplay } from '../lib/utils';
import { Filter, Calendar, LayoutList } from 'lucide-react';
import { parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardPageProps {
  facilities: Facility[];
  bookings: Booking[];
  refetch: () => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  facilities,
  bookings,
  refetch,
}) => {
  const {
    selectedDate,
    isQuickBookOpen,
    quickBookDraft,
    activeBookingDetailId,
    activeCollectPaymentBookingId,
    isFacilityManagerOpen,
    mobileViewMode,
    openQuickBook,
    closeQuickBook,
    openBookingDetail,
    closeBookingDetail,
    openCollectPayment,
    closeCollectPayment,
    closeFacilityManager,
    setMobileViewMode,
  } = useUIStore();

  const [facilityTypeFilter, setFacilityTypeFilter] = React.useState<'ALL' | 'GROUND' | 'NET' | 'TURF_NET'>('ALL');

  const filteredFacilities = React.useMemo(() => {
    if (facilityTypeFilter === 'ALL') return facilities;
    return facilities.filter(f => f.type === facilityTypeFilter);
  }, [facilities, facilityTypeFilter]);

  const filteredBookings = React.useMemo(() => {
    if (facilityTypeFilter === 'ALL') return bookings;
    return bookings.filter(b => b.facility?.type === facilityTypeFilter);
  }, [bookings, facilityTypeFilter]);

  const activeBookingDetail = React.useMemo(() => {
    return bookings.find(b => b.id === activeBookingDetailId) || null;
  }, [bookings, activeBookingDetailId]);

  const activeBookingForPayment = React.useMemo(() => {
    return bookings.find(b => b.id === activeCollectPaymentBookingId) || null;
  }, [bookings, activeCollectPaymentBookingId]);

  const parsedDate = React.useMemo(() => {
    return parseISO(`${selectedDate}T00:00:00`);
  }, [selectedDate]);

  const handleSlotClick = (facility: Facility, timeSlot: string) => {
    openQuickBook({
      facilityId: facility.id,
      date: selectedDate,
      startTime: timeSlot,
      durationMins: 60,
    });
  };

  const handleQuickBookSubmit = async (formData: QuickBookFormData, openWhatsApp: boolean) => {
    const newBooking = await createQuickBooking(formData);
    await refetch();

    if (openWhatsApp) {
      const facility = facilities.find(f => f.id === formData.facility_id);
      const link = buildWhatsAppBookingLink({
        phone: formData.customer_phone,
        facilityName: facility?.name || 'Cricket Facility',
        startIso: newBooking.start_time,
        endIso: newBooking.end_time,
        totalAmount: formData.total_amount,
        advancePaid: formData.advance_paid,
        pendingAmount: Math.max(0, formData.total_amount - formData.advance_paid),
      });

      // Synchronous navigation on mobile / tab open on desktop
      window.open(link, '_blank');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await refetch();
    closeBookingDetail();
  };

  const handleCollectPayment = async (
    bookingId: string, 
    amount: number, 
    method: 'UPI' | 'CASH' | 'CARD', 
    notes?: string,
    transactionReference?: string
  ) => {
    await recordPayment(bookingId, amount, method, notes, transactionReference);
    await refetch();
    closeCollectPayment();
    closeBookingDetail();
  };

  const handleSaveFacility = async (fac: any) => {
    await saveFacility(fac);
    await refetch();
  };

  const handleDeleteFacility = async (id: string) => {
    await deleteFacility(id);
    await refetch();
  };

  return (
    <div className="space-y-3 pb-20 md:pb-8">
      {/* Top Controls & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <span className="text-[#a1a1aa] mr-1 hidden sm:inline-flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'ALL', label: `All (${facilities.length})` },
            { id: 'GROUND', label: 'Ground' },
            { id: 'NET', label: 'Nets (1-5)' },
            { id: 'TURF_NET', label: 'Turf Nets (1-2)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFacilityTypeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                facilityTypeFilter === tab.id
                  ? 'bg-[#27272a] text-[#f4f4f5] border border-[#3f3f46]'
                  : 'bg-[#18181b] text-[#a1a1aa] hover:text-[#f4f4f5] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle for Mobile & Date Indicator */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          {/* Mobile Switcher (Run Sheet vs Timeline Grid) */}
          <div className="flex md:hidden bg-[#18181b] border border-[#27272a] rounded-lg p-0.5">
            <button
              onClick={() => setMobileViewMode('runsheet')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                mobileViewMode === 'runsheet'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-[#a1a1aa]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Run-Sheet
            </button>
            <button
              onClick={() => setMobileViewMode('matrix')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                mobileViewMode === 'matrix'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-[#a1a1aa]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Grid
            </button>
          </div>

          <div className="text-xs text-[#a1a1aa] font-medium hidden sm:block">
            <span>Viewing: </span>
            <span className="font-bold text-emerald-400">
              {formatDateDisplay(`${selectedDate}T12:00:00`)}
            </span>
          </div>
        </div>
      </div>

      {/* Reconciliation Daily Status Quick Widget (Priority 5) */}
      <div className="p-3.5 bg-[#18181b] border border-[#27272a] hover:border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="text-sm">⚖️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">
                Day Reconciliation Status
              </h4>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">
                {selectedDate}
              </span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              Reconcile physical cash drawer count and UPI bank settlements at the end of each shift.
            </p>
          </div>
        </div>

        <Link
          to="/reconciliation"
          className="px-3.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#3f3f46] shrink-0"
        >
          <span>Reconcile Register ↵</span>
        </Link>
      </div>

      {/* Main Viewport: Desktop Grid or Mobile Run-Sheet */}
      <div className="hidden md:block">
        <TimelineGrid
          facilities={filteredFacilities}
          bookings={bookings}
          selectedDate={parsedDate}
          onSlotClick={handleSlotClick}
          onBookingClick={(b) => openBookingDetail(b.id)}
        />
      </div>

      <div className="md:hidden">
        {mobileViewMode === 'runsheet' ? (
          <MobileRunSheet
            bookings={filteredBookings}
            onBookingClick={(b) => openBookingDetail(b.id)}
            onCollectPayment={(b) => openCollectPayment(b.id)}
            onOpenQuickBook={() => openQuickBook({ date: selectedDate })}
          />
        ) : (
          <TimelineGrid
            facilities={filteredFacilities}
            bookings={bookings}
            selectedDate={parsedDate}
            onSlotClick={handleSlotClick}
            onBookingClick={(b) => openBookingDetail(b.id)}
          />
        )}
      </div>

      {/* Modals & Drawers */}
      <QuickBookDrawer
        isOpen={isQuickBookOpen}
        onClose={closeQuickBook}
        facilities={facilities}
        initialFacilityId={quickBookDraft?.facilityId}
        initialDate={quickBookDraft?.date || selectedDate}
        initialTime={quickBookDraft?.startTime || '06:00'}
        customerPhone={quickBookDraft?.customerPhone}
        customerName={quickBookDraft?.customerName}
        onSuccess={handleQuickBookSubmit}
      />

      <BookingDetailModal
        booking={activeBookingDetail}
        facilities={facilities}
        onClose={closeBookingDetail}
        onOpenCollectPayment={(b) => openCollectPayment(b.id)}
        onCancelBooking={handleCancelBooking}
      />

      <CollectPaymentModal
        booking={activeBookingForPayment}
        onClose={closeCollectPayment}
        onCollect={handleCollectPayment}
      />

      <FacilityManagerModal
        isOpen={isFacilityManagerOpen}
        onClose={closeFacilityManager}
        facilities={facilities}
        onSaveFacility={handleSaveFacility}
        onDeleteFacility={handleDeleteFacility}
      />
    </div>
  );
};
