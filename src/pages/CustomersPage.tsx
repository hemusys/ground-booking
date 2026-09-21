import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerSummary } from '../types';
import { formatCurrency, formatDateDisplay, formatTimeDisplay } from '../lib/utils';
import { Users, Search, Phone, MessageSquare, X, CheckCircle2 } from 'lucide-react';

interface CustomersPageProps {
  customers: CustomerSummary[];
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ customers }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const filtered = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const cleanPhone = searchQuery.replace(/\D/g, '');
    const cPhoneClean = c.phone.replace(/\D/g, '');
    return (
      c.name.toLowerCase().includes(q) ||
      (cleanPhone && (cPhoneClean.includes(cleanPhone) || cleanPhone.includes(cPhoneClean))) ||
      (c.team_name && c.team_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 rounded-2xl border border-[#27272a]">
        <div>
          <h2 className="text-lg font-bold text-[#f4f4f5] flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Customer Directory
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {customers.length} registered players & teams
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#09090b] border border-[#27272a] rounded-xl pl-9 pr-3 py-2 text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-hidden focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#f4f4f5]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Customer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to={`/customers/${c.id}`}
            className="p-4 bg-[#18181b] border border-[#27272a] hover:border-emerald-500/40 rounded-xl transition-all shadow-md cursor-pointer flex flex-col justify-between gap-3 group"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm sm:text-base text-[#f4f4f5] group-hover:text-emerald-400 transition-colors">
                      {c.name}
                    </h3>
                    {c.is_blacklisted && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                        BLACKLISTED
                      </span>
                    )}
                  </div>
                  {c.team_name ? (
                    <span className="text-xs text-emerald-400 font-medium">
                      🏏 {c.team_name}
                    </span>
                  ) : (
                    <span className="text-xs text-[#71717a]">Individual Player</span>
                  )}
                </div>

                <span className="text-xs px-2 py-0.5 rounded-full bg-[#27272a] text-[#a1a1aa] font-mono">
                  {c.booking_count} bookings
                </span>
              </div>

              <div className="text-xs font-mono text-[#a1a1aa] mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-[#71717a]" />
                  +91 {c.phone}
                </span>
                <span className="text-[10px] text-zinc-500 font-sans">
                  Reliability: <strong className="text-emerald-400">{c.reliability_score || 100}%</strong>
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#27272a] flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-[#71717a] block uppercase font-bold">
                  Total Spent
                </span>
                <span className="font-bold font-mono-numeric text-emerald-400">
                  {formatCurrency(c.total_spent)}
                </span>
              </div>

              {c.total_pending > 0 ? (
                <div className="text-right">
                  <span className="text-[10px] text-amber-400 block uppercase font-bold">
                    Pending Due
                  </span>
                  <span className="font-bold font-mono-numeric text-amber-400">
                    {formatCurrency(c.total_pending)}
                  </span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-[10px] text-emerald-500/80 block uppercase font-bold">
                    Account Status
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Settled
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Customer 360 Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-xl bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#f4f4f5]">
                  {selectedCustomer.name}
                </h3>
                <p className="text-xs text-emerald-400">
                  {selectedCustomer.team_name ? `🏏 ${selectedCustomer.team_name} • ` : ''}
                  +91 {selectedCustomer.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase block">Bookings</span>
                  <span className="text-base font-bold text-[#f4f4f5] font-mono">
                    {selectedCustomer.booking_count}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase block">Total Spent</span>
                  <span className="text-base font-bold text-emerald-400 font-mono-numeric">
                    {formatCurrency(selectedCustomer.total_spent)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#a1a1aa] uppercase block">Outstanding</span>
                  <span className={`text-base font-bold font-mono-numeric ${
                    selectedCustomer.total_pending > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {formatCurrency(selectedCustomer.total_pending)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider block">
                  Match & Net Bookings
                </span>

                {selectedCustomer.bookings.length === 0 ? (
                  <p className="text-xs text-[#71717a] py-4 text-center">
                    No bookings recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.bookings.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-[#f4f4f5]">
                            {b.facility?.name || 'Facility'}
                          </div>
                          <div className="text-[11px] text-[#a1a1aa] font-mono">
                            {formatDateDisplay(b.start_time)} • {formatTimeDisplay(b.start_time)} - {formatTimeDisplay(b.end_time)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold font-mono-numeric text-emerald-400">
                            {formatCurrency(b.total_amount)}
                          </div>
                          <span className={`text-[10px] font-semibold ${
                            b.payment_status === 'FULLY_PAID'
                              ? 'text-emerald-400'
                              : b.payment_status === 'PARTIALLY_PAID'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {b.payment_status === 'FULLY_PAID' ? 'Paid' : `Due: ₹${b.pending_amount}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-[#18181b] border-t border-[#27272a] flex items-center justify-end gap-2">
              <a
                href={`tel:${selectedCustomer.phone}`}
                className="px-3.5 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Customer</span>
              </a>
              <a
                href={`https://wa.me/91${selectedCustomer.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 fill-zinc-950" />
                <span>Open WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
