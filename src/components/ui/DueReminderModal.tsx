import React, { useState } from 'react';
import { Booking } from '../../types';
import { 
  formatWhatsAppPhone, 
  interpolateReminderTemplate, 
  buildWhatsAppUrl, 
  DEFAULT_REMINDER_TEMPLATE 
} from '../../lib/whatsapp';
import { formatDateDisplay, formatTimeDisplay, formatCurrency } from '../../lib/utils';
import { 
  X, 
  MessageSquare, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Building2, 
  Send 
} from 'lucide-react';

interface DueReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  defaultGroundName?: string;
}

export const DueReminderModal: React.FC<DueReminderModalProps> = ({
  isOpen,
  onClose,
  bookings,
  defaultGroundName = 'Apex Cricket Arena',
}) => {
  const [groundName, setGroundName] = useState<string>(defaultGroundName);
  const [template, setTemplate] = useState<string>(DEFAULT_REMINDER_TEMPLATE);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen || bookings.length === 0) return null;

  const handleCopyMessage = (booking: Booking) => {
    const text = interpolateReminderTemplate(template, {
      phone: booking.customer?.phone || '',
      customerName: booking.customer?.name,
      facilityName: booking.facility?.name || 'Cricket Facility',
      startIso: booking.start_time,
      endIso: booking.end_time,
      totalAmount: booking.total_amount,
      advancePaid: booking.total_paid || 0,
      pendingAmount: booking.pending_amount || 0,
      groundName,
    });

    navigator.clipboard.writeText(text);
    setCopiedId(booking.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendClick = (bookingId: string) => {
    setSentMap(prev => ({ ...prev, [bookingId]: true }));
  };

  const totalOutstanding = bookings.reduce((sum, b) => sum + (b.pending_amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#f4f4f5] leading-tight">
                WhatsApp Due Reminders
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                {bookings.length} recipient{bookings.length === 1 ? '' : 's'} • Total Due: <span className="text-amber-400 font-bold font-mono">{formatCurrency(totalOutstanding)}</span>
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

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Ground Name Configuration */}
          <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#a1a1aa] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ground / Arena Name</span>
              </label>
              <span className="text-[10px] text-zinc-500">Auto-filled into message header</span>
            </div>
            <input
              type="text"
              value={groundName}
              onChange={(e) => setGroundName(e.target.value)}
              placeholder="e.g. Apex Cricket Arena"
              className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden"
            />
          </div>

          {/* Template Preview */}
          <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#a1a1aa] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Message Template Preview</span>
              </span>
              <button
                type="button"
                onClick={() => setTemplate(DEFAULT_REMINDER_TEMPLATE)}
                className="text-[10px] text-emerald-400 hover:underline font-medium"
              >
                Reset Template
              </button>
            </div>

            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg p-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-hidden leading-relaxed"
            />
            <div className="text-[10px] text-zinc-500">
              Placeholders: <span className="text-zinc-400">{'{ground_name}'}</span>, <span className="text-zinc-400">{'{customer_name}'}</span>, <span className="text-zinc-400">{'{facility_name}'}</span>, <span className="text-zinc-400">{'{date}'}</span>, <span className="text-zinc-400">{'{time}'}</span>, <span className="text-zinc-400">{'{total_amount}'}</span>, <span className="text-zinc-400">{'{paid_amount}'}</span>, <span className="text-zinc-400">{'{due_amount}'}</span>
            </div>
          </div>

          {/* Recipients List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#a1a1aa] px-1">
              <span>Recipients ({bookings.length})</span>
              <span>1-Click Direct WhatsApp</span>
            </div>

            <div className="space-y-2">
              {bookings.map((b) => {
                const message = interpolateReminderTemplate(template, {
                  phone: b.customer?.phone || '',
                  customerName: b.customer?.name,
                  facilityName: b.facility?.name || 'Cricket Facility',
                  startIso: b.start_time,
                  endIso: b.end_time,
                  totalAmount: b.total_amount,
                  advancePaid: b.total_paid || 0,
                  pendingAmount: b.pending_amount || 0,
                  groundName,
                });

                const whatsAppUrl = buildWhatsAppUrl(b.customer?.phone || '', message);
                const isSent = sentMap[b.id];
                const isCopied = copiedId === b.id;

                return (
                  <div
                    key={b.id}
                    className="p-3 bg-[#18181b] border border-[#27272a] hover:border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[#f4f4f5] truncate">
                          {b.customer?.name}
                        </span>
                        {b.customer?.team_name && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                            {b.customer.team_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#a1a1aa] truncate">
                        +91 {b.customer?.phone} • {b.facility?.name} • {formatDateDisplay(b.start_time)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-amber-400">
                          {formatCurrency(b.pending_amount || 0)}
                        </div>
                        <div className="text-[9px] text-zinc-500 uppercase">
                          Due
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(b)}
                        className="p-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                        title="Copy message text"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>

                      <a
                        href={whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleSendClick(b.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                          isSent 
                            ? 'bg-zinc-800 text-emerald-300 border border-emerald-500/30' 
                            : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 active:scale-95'
                        }`}
                      >
                        {isSent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </>
                        )}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#18181b] border-t border-[#27272a] flex items-center justify-between text-xs text-[#a1a1aa]">
          <span>💡 Direct deep links launch WhatsApp Web or Mobile App with pre-filled text.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
