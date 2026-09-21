import React from 'react';
import { Booking } from '../types';
import { formatCurrency, formatTimeDisplay } from '../lib/utils';
import { buildWhatsAppBookingLink } from '../lib/whatsapp';
import { formatDurationLabel } from '../lib/time';
import { differenceInMinutes, parseISO } from 'date-fns';
import { Phone, MessageSquare, DollarSign, Clock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';

interface MobileRunSheetProps {
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
  onCollectPayment: (booking: Booking) => void;
  onOpenQuickBook: () => void;
}

export const MobileRunSheet: React.FC<MobileRunSheetProps> = ({
  bookings,
  onBookingClick,
  onCollectPayment,
  onOpenQuickBook,
}) => {
  if (bookings.length === 0) {
    return (
      <div className="p-8 text-center bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3 my-2">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-xl">
          🏏
        </div>
        <h3 className="text-sm font-bold text-[#f4f4f5]">
          No Bookings for This Date
        </h3>
        <p className="text-xs text-[#a1a1aa] max-w-xs mx-auto">
          All grounds and cricket nets are completely free.
        </p>
        <button
          onClick={onOpenQuickBook}
          className="mt-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Booking in &lt;10s</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 my-2">
      {bookings.map((b) => {
        const isPaid = b.payment_status === 'FULLY_PAID';
        const isPartial = b.payment_status === 'PARTIALLY_PAID';
        const pending = b.pending_amount || 0;

        const durationMins = differenceInMinutes(parseISO(b.end_time), parseISO(b.start_time));
        const formattedDuration = formatDurationLabel(durationMins);

        const whatsAppLink = buildWhatsAppBookingLink({
          phone: b.customer?.phone || '',
          facilityName: b.facility?.name || 'Cricket Facility',
          startIso: b.start_time,
          endIso: b.end_time,
          totalAmount: b.total_amount,
          advancePaid: b.total_paid || 0,
          pendingAmount: pending,
        });

        const telLink = `tel:${(b.customer?.phone || '').replace(/[^\d+]/g, '')}`;

        return (
          <div
            key={b.id}
            onClick={() => onBookingClick(b)}
            className={`p-3.5 rounded-xl border bg-[#18181b] transition-all shadow-md active:scale-[0.99] ${
              isPaid
                ? 'border-emerald-500/30'
                : isPartial
                ? 'border-amber-500/40'
                : 'border-rose-500/40'
            }`}
          >
            {/* Top Row: Time & Facility */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#27272a]">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#f4f4f5]">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{formatTimeDisplay(b.start_time)} – {formatTimeDisplay(b.end_time)}</span>
                <span className="text-[10px] text-[#71717a] font-normal font-sans">
                  ({formattedDuration})
                </span>
              </div>

              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                b.facility?.type === 'GROUND'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : b.facility?.type === 'TURF_NET'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {b.facility?.type === 'GROUND' ? '🏟️ ' : b.facility?.type === 'TURF_NET' ? '🌱 ' : '🏏 '}{b.facility?.name}
              </span>
            </div>

            {/* Middle Row: Customer, Team & Financials */}
            <div className="py-2.5 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-sm text-[#f4f4f5]">
                  {b.customer?.name}
                </div>
                {b.customer?.team_name ? (
                  <div className="text-xs text-emerald-400 font-medium mt-0.5">
                    🏏 {b.customer.team_name}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#71717a] mt-0.5">
                    +91 {b.customer?.phone}
                  </div>
                )}
              </div>

              {/* Price & Payment Pill */}
              <div className="text-right">
                <div className="font-mono-numeric font-bold text-sm text-[#f4f4f5]">
                  {formatCurrency(b.total_amount)}
                </div>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Paid Full
                  </span>
                ) : isPartial ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold font-mono mt-0.5">
                    <AlertCircle className="w-3 h-3" /> Due: ₹{pending}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold font-mono mt-0.5">
                    UNPAID (₹{b.total_amount})
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Actions Row: One-tap Call, WhatsApp, Settle */}
            <div className="pt-2 border-t border-[#27272a] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <a
                  href={telLink}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-lg bg-[#27272a] active:bg-[#3f3f46] text-emerald-400 text-xs flex items-center gap-1 font-semibold"
                  title="Call Player"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>

                <a
                  href={whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-lg bg-emerald-500/15 active:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1 font-semibold"
                  title="Send WhatsApp Confirmation"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>

              {pending > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollectPayment(b);
                  }}
                  className="px-3 py-2 rounded-lg bg-amber-500 active:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Collect ₹{pending}</span>
                </button>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
