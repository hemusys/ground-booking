import React, { useState, useEffect } from 'react';
import { Booking, BrokerStats, Facility } from '../types';
import { fetchBrokerStats, fetchBrokers, cancelBooking } from '../lib/api';
import { useUIStore } from '../stores/useUIStore';
import { formatDurationLabel } from '../lib/time';
import { formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { BookingDetailModal } from '../components/BookingDetailModal';
import { EditBookingModal } from '../components/EditBookingModal';
import {
  Calendar,
  Clock,
  Plus,
  TrendingUp,
  CheckCircle2,
  CalendarCheck,
  Building,
  UserCheck,
  Users,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';

interface BrokerDashboardPageProps {
  bookings: Booking[];
  facilities: Facility[];
  refetch: () => Promise<void>;
}

export const BrokerDashboardPage: React.FC<BrokerDashboardPageProps> = ({
  bookings,
  facilities,
  refetch,
}) => {
  const { activeBrokerId, openQuickBook } = useUIStore();
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [brokerName, setBrokerName] = useState<string>('Broker');
  const [brokerCode, setBrokerCode] = useState<string>('BRK');
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<Booking | null>(null);

  useEffect(() => {
    if (!activeBrokerId) return;

    fetchBrokers().then((allBrokers) => {
      const active = allBrokers.find((b) => b.id === activeBrokerId);
      if (active) {
        setBrokerName(active.name);
        setBrokerCode(active.code);
      }
    });

    fetchBrokerStats(activeBrokerId).then(setStats).catch(console.error);
  }, [activeBrokerId, bookings]);

  // Filter bookings created by this broker
  const myBookings = bookings
    .filter((b) => b.broker_id === activeBrokerId && !b.is_cancelled)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const handleCancel = async (bookingId: string) => {
    await cancelBooking(bookingId);
    await refetch();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-[#18181b] to-zinc-900 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold font-mono">
                {brokerCode}
              </span>
              <span className="text-xs text-[#a1a1aa] font-medium">Broker Partner Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#f4f4f5]">
              Welcome, {brokerName}
            </h1>
            <p className="text-xs text-[#a1a1aa] max-w-xl">
              Track your ground slots, view upcoming matches, and submit bookings directly into the facility schedule.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/calendar"
              className="px-3.5 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold text-xs transition-colors flex items-center gap-1.5 border border-[#3f3f46]"
            >
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>View Grid</span>
            </Link>

            <button
              type="button"
              onClick={() => openQuickBook({ date: new Date().toISOString().split('T')[0] })}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Book Ground</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5 Strictly Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Bookings */}
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-semibold">Total Bookings</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#f4f4f5]">
            {stats?.total_bookings ?? myBookings.length}
          </div>
          <span className="text-[11px] text-[#71717a] block">All-time count</span>
        </div>

        {/* Card 2: Total Hours Booked */}
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-semibold">Hours Booked</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {stats?.total_hours_booked ?? 0} hrs
          </div>
          <span className="text-[11px] text-[#71717a] block">Total duration</span>
        </div>

        {/* Card 3: Today's Bookings */}
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-semibold">Today's Bookings</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {stats?.today_bookings ?? 0}
          </div>
          <span className="text-[11px] text-[#71717a] block">Scheduled today</span>
        </div>

        {/* Card 4: This Month Bookings */}
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-semibold">This Month</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {stats?.this_month_bookings ?? 0}
          </div>
          <span className="text-[11px] text-[#71717a] block">Current calendar month</span>
        </div>

        {/* Card 5: Upcoming Bookings */}
        <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-semibold">Upcoming</span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {stats?.upcoming_bookings ?? 0}
          </div>
          <span className="text-[11px] text-[#71717a] block">Future sessions</span>
        </div>
      </div>

      {/* Broker Bookings Section */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-[#f4f4f5] flex items-center gap-2">
              <span>My Booking Portfolio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa] font-mono">
                {myBookings.length}
              </span>
            </h2>
            <p className="text-xs text-[#a1a1aa]">
              Bookings attributed to your broker account ({brokerCode})
            </p>
          </div>

          <Link
            to="/bookings"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {myBookings.length === 0 ? (
          <div className="py-12 text-center bg-[#09090b] border border-[#27272a] rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-xl">
              🏏
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">No Bookings Yet</h3>
            <p className="text-xs text-[#a1a1aa] max-w-sm mx-auto">
              You haven't placed any bookings under {brokerName} ({brokerCode}) yet. Click below to book your first slot.
            </p>
            <button
              type="button"
              onClick={() => openQuickBook({ date: new Date().toISOString().split('T')[0] })}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create First Booking</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {myBookings.slice(0, 8).map((b) => {
              const whatsAppLink = buildWhatsAppBookingLink({
                phone: b.customer?.phone || '',
                customerName: b.customer?.name,
                facilityName: b.facility?.name || 'Facility',
                startIso: b.start_time,
                endIso: b.end_time,
                totalAmount: b.total_amount,
                advancePaid: b.total_paid || 0,
                pendingAmount: b.pending_amount || 0,
              });

              return (
                <div
                  key={b.id}
                  className="p-3.5 bg-[#09090b] border border-[#27272a] hover:border-zinc-600 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#27272a] text-xs font-bold text-[#f4f4f5]">
                        {b.facility?.name}
                      </span>
                      <span className="text-xs font-mono text-[#f4f4f5] font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        {formatDateDisplay(b.start_time)}
                      </span>
                      <span className="text-xs font-mono text-[#a1a1aa] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#71717a]" />
                        {formatTimeDisplay(b.start_time)} – {formatTimeDisplay(b.end_time)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <span className="text-sm font-bold text-[#f4f4f5]">
                        {b.customer?.name}
                      </span>
                      {b.team_b_name ? (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{b.team_a_name || b.customer?.name} vs {b.team_b_name}</span>
                        </span>
                      ) : b.customer?.team_name ? (
                        <span className="text-xs text-emerald-400 font-medium">
                          • {b.customer.team_name}
                        </span>
                      ) : null}
                      <span className="text-xs font-mono text-[#a1a1aa]">
                        +91 {b.customer?.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <a
                      href={whatsAppLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs transition-colors"
                      title="WhatsApp Confirmation"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setSelectedBookingForEdit(b)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold transition-colors"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBookingForDetails(b)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold text-xs border border-emerald-500/30 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedBookingForDetails && (
        <BookingDetailModal
          booking={selectedBookingForDetails}
          facilities={facilities}
          onClose={() => setSelectedBookingForDetails(null)}
          onOpenCollectPayment={() => {}}
          onCancelBooking={handleCancel}
          onRefresh={refetch}
        />
      )}

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
    </div>
  );
};
