import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUIStore } from '../stores/useUIStore';
import { Clock, AlertCircle, Plus, Calendar as CalendarIcon, Briefcase, LayoutDashboard, Search } from 'lucide-react';

interface BottomNavProps {
  dueCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ dueCount = 0 }) => {
  const { openQuickBook, selectedDate, currentRole } = useUIStore();
  const isOwner = currentRole === 'OWNER';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#18181b]/95 backdrop-blur-lg border-t border-[#27272a] px-2 py-2">
      <div className="flex items-center justify-around relative">
        {isOwner ? (
          <>
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <Clock className="w-4 h-4" />
              <span>Timeline</span>
            </NavLink>

            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendar</span>
            </NavLink>

            {/* Floating Center Quick Book Action */}
            <button
              onClick={() => openQuickBook({ date: selectedDate })}
              className="flex flex-col items-center -mt-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 p-2.5 rounded-full shadow-lg shadow-emerald-500/20 border-2 border-[#09090b] transition-transform"
              aria-label="Quick Book"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <NavLink
              to="/due"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium relative transition-colors ${
                  isActive ? 'text-amber-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <div className="relative">
                <AlertCircle className="w-4 h-4" />
                {dueCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.1 rounded-full bg-amber-500 text-zinc-950 text-[8px] font-mono font-bold leading-none">
                    {dueCount}
                  </span>
                )}
              </div>
              <span>Due</span>
            </NavLink>

            <NavLink
              to="/brokers"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-amber-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <Briefcase className="w-4 h-4" />
              <span>Brokers</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/broker-dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <Clock className="w-4 h-4" />
              <span>Timeline</span>
            </NavLink>

            {/* Floating Center Quick Book Action */}
            <button
              onClick={() => openQuickBook({ date: selectedDate })}
              className="flex flex-col items-center -mt-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 p-2.5 rounded-full shadow-lg shadow-emerald-500/20 border-2 border-[#09090b] transition-transform"
              aria-label="Quick Book"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>

            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Calendar</span>
            </NavLink>

            <NavLink
              to="/bookings"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
                }`
              }
            >
              <Search className="w-4 h-4" />
              <span>Bookings</span>
            </NavLink>
          </>
        )}
      </div>
    </div>
  );
};
