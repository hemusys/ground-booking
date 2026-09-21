import React, { useState } from 'react';
import { Booking } from '../types';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { DueReminderModal } from '../components/ui/DueReminderModal';
import { recordPayment, cancelBooking } from '../lib/api';
import { 
  AlertCircle, 
  Phone, 
  MessageSquare, 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Send, 
  Users 
} from 'lucide-react';

interface DueCollectionsPageProps {
  dueBookings: Booking[];
  refetch: () => Promise<void>;
}

export const DueCollectionsPage: React.FC<DueCollectionsPageProps> = ({
  dueBookings,
  refetch,
}) => {
  const [activeBookingForPayment, setActiveBookingForPayment] = useState<Booking | null>(null);
  const [activeBookingDetail, setActiveBookingDetail] = useState<Booking | null>(null);
  const [reminderModalBookings, setReminderModalBookings] = useState<Booking[] | null>(null);

  const totalOutstanding = dueBookings.reduce((sum, b) => sum + (b.pending_amount || 0), 0);

  const handleCollectPayment = async (
    bookingId: string, 
    amount: number, 
    method: 'UPI' | 'CASH' | 'CARD', 
    notes?: string,
    transactionReference?: string
  ) => {
    await recordPayment(bookingId, amount, method, notes, transactionReference);
    await refetch();
    setActiveBookingForPayment(null);
  };

  const handleCancelBooking = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await refetch();
    setActiveBookingDetail(null);
  };

  const handleOpenSingleReminder = (booking: Booking) => {
    setReminderModalBookings([booking]);
  };

  const handleOpenBulkReminders = () => {
    setReminderModalBookings(dueBookings);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 bg-[#18181b] border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4" />
            <span>Pending Collections Ledger</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-mono-numeric text-[#f4f4f5] mt-1">
            {formatCurrency(totalOutstanding)}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Total unpaid balance across {dueBookings.length} active booking{dueBookings.length === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {dueBookings.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBulkReminders}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Send WhatsApp Reminders ({dueBookings.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Due Bookings List */}
      {dueBookings.length === 0 ? (
        <div className="p-12 text-center bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#f4f4f5]">
            Zero Pending Balances!
          </h3>
          <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
            All ground and net bookings have been fully paid.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dueBookings.map((b) => {
            const pending = b.pending_amount || 0;
            const telLink = `tel:${(b.customer?.phone || '').replace(/[^\d+]/g, '')}`;

            return (
              <div
                key={b.id}
                className="p-4 bg-[#18181b] border border-[#27272a] hover:border-amber-500/40 rounded-xl transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div 
                  className="space-y-1 cursor-pointer flex-1"
                  onClick={() => setActiveBookingDetail(b)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-[#f4f4f5]">
                      {b.customer?.name}
                    </span>
                    {b.customer?.team_name && (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        🏏 {b.customer.team_name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#a1a1aa]">
                    <span className="font-semibold text-emerald-400">
                      {b.facility?.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-[#71717a]" />
                      {formatDateDisplay(b.start_time)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#71717a]" />
                      {formatTimeDisplay(b.start_time)} – {formatTimeDisplay(b.end_time)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[#27272a]">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider">
                      Pending Due
                    </div>
                    <div className="font-bold font-mono-numeric text-base text-amber-400">
                      {formatCurrency(pending)}
                    </div>
                    <div className="text-[10px] text-[#71717a] font-mono">
                      Total: {formatCurrency(b.total_amount)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={telLink}
                      className="p-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-emerald-400 transition-colors"
                      title="Call Customer"
                    >
                      <Phone className="w-4 h-4" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleOpenSingleReminder(b)}
                      className="p-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                      title="Send WhatsApp Reminder"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveBookingForPayment(b)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <DollarSign className="w-4 h-4 stroke-[2.5]" />
                      <span>Collect</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collect Payment Modal */}
      <CollectPaymentModal
        booking={activeBookingForPayment}
        onClose={() => setActiveBookingForPayment(null)}
        onCollect={handleCollectPayment}
      />

      {/* Booking Detail Modal with Activity Timeline */}
      <BookingDetailModal
        booking={activeBookingDetail}
        onClose={() => setActiveBookingDetail(null)}
        onOpenCollectPayment={(b) => setActiveBookingForPayment(b)}
        onCancelBooking={handleCancelBooking}
        onRefresh={refetch}
      />

      {/* WhatsApp Due Reminder Modal */}
      {reminderModalBookings && (
        <DueReminderModal
          isOpen={Boolean(reminderModalBookings)}
          onClose={() => setReminderModalBookings(null)}
          bookings={reminderModalBookings}
        />
      )}
    </div>
  );
};
