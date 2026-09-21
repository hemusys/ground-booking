import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { formatCurrency } from '../lib/utils';
import { 
  Clock, 
  AlertCircle, 
  Users, 
  Plus, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Search
} from 'lucide-react';
import { addDays, format, parseISO, subDays } from 'date-fns';
import { MiniCalendarPicker } from './ui/MiniCalendarPicker';
import { InstallPwaButton } from './ui/InstallPwaButton';

interface HeaderProps {
  stats?: {
    totalBookings: number;
    collectedToday: number;
    pendingToday: number;
    upiCollected: number;
    cashCollected: number;
  };
  dueCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ stats, dueCount = 0 }) => {
  const location = useLocation();
  const { 
    selectedDate, 
    setSelectedDate, 
    openQuickBook, 
    openFacilityManager 
  } = useUIStore();

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
  const parsedCurrentDate = parseISO(`${selectedDate}T00:00:00`);

  // Keyboard shortcut 'N' for Quick Booking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openQuickBook({ date: selectedDate });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickBook, selectedDate]);

  return (
    <header className="sticky top-0 z-30 bg-[#09090b]/95 backdrop-blur-md border-b border-[#27272a] px-3 sm:px-6 py-2.5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        {/* Brand & Date Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-base group-hover:bg-emerald-500/20 transition-colors">
              🏏
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#f4f4f5] leading-none flex items-center gap-1.5">
                Ground Manager
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-normal">
                  OWNER
                </span>
              </h1>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5 hidden sm:block">
                Cricket Ground & Net Operations
              </p>
            </div>
          </Link>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setSelectedDate(format(subDays(parsedCurrentDate, 1), 'yyyy-MM-dd'))}
                className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  isToday
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
              >
                {isToday ? 'Today' : format(parsedCurrentDate, 'dd MMM')}
              </button>
              <button
                onClick={() => setSelectedDate(format(addDays(parsedCurrentDate, 1), 'yyyy-MM-dd'))}
                className="p-1.5 hover:bg-[#27272a] rounded text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <MiniCalendarPicker
              selectedDateStr={selectedDate}
              onSelectDate={(newDate) => setSelectedDate(newDate)}
              className="hidden sm:inline-block"
            />
          </div>
        </div>

        {/* Operational Metrics & Nav */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 overflow-x-auto pb-1 sm:pb-0">
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-[#18181b] border border-[#27272a] p-1 rounded-lg text-xs font-medium">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname === '/'
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </Link>
            <Link
              to="/calendar"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname.startsWith('/calendar')
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
              Calendar
            </Link>
            <Link
              to="/bookings"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname === '/bookings'
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              Search
            </Link>
            <Link
              to="/due"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname === '/due'
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Due Collections
              {dueCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  {dueCount}
                </span>
              )}
            </Link>
            <Link
              to="/customers"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname.startsWith('/customers')
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Customers
            </Link>
            <Link
              to="/reconciliation"
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                location.pathname === '/reconciliation'
                  ? 'bg-[#27272a] text-[#f4f4f5]'
                  : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
              }`}
            >
              <span className="text-xs">⚖️</span>
              Reconcile
            </Link>
          </nav>

          {/* Real-time Collected & Pending Totals */}
          {stats && (
            <div className="flex items-center gap-2 text-xs">
              <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[#a1a1aa] hidden sm:inline">Collected:</span>
                <span className="font-mono-numeric font-bold text-emerald-400">
                  {formatCurrency(stats.collectedToday)}
                </span>
              </div>

              {stats.pendingToday > 0 && (
                <Link
                  to="/due"
                  className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center gap-1.5 hover:bg-amber-900/30 transition-colors"
                  title="Click to view pending collections"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[#a1a1aa] hidden sm:inline">Pending:</span>
                  <span className="font-mono-numeric font-bold text-amber-400">
                    {formatCurrency(stats.pendingToday)}
                  </span>
                </Link>
              )}
            </div>
          )}

          {/* PWA Install Action */}
          <InstallPwaButton />

          {/* Settings Trigger */}
          <button
            onClick={openFacilityManager}
            className="p-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#27272a] transition-colors"
            title="Manage Facilities & Pricing"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Primary Quick Book Action */}
          <button
            onClick={() => openQuickBook({ date: selectedDate })}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Quick Book</span>
            <kbd className="hidden lg:inline-block ml-1 px-1 py-0.2 bg-emerald-600/30 rounded text-[10px] font-mono text-zinc-950">
              N
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
