import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, ChevronDown, Check } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { fetchBrokers } from '../../lib/api';
import { Broker } from '../../types';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, activeBrokerId, setUserRole, setActiveBroker, showToast } = useUIStore();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchBrokers().then(setBrokers).catch(console.error);
  }, []);

  const activeBroker = brokers.find((b) => b.id === activeBrokerId);

  const handleSelectOwner = () => {
    setUserRole('OWNER');
    setIsOpen(false);
    showToast('Switched to Owner / Admin Mode', 'info');
  };

  const handleSelectBroker = (broker: Broker) => {
    setActiveBroker(broker.id);
    setIsOpen(false);
    showToast(`Switched to Broker View: ${broker.name} (${broker.code})`, 'info');
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border shadow-sm transition-all focus:outline-none ${
          currentRole === 'OWNER'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
        }`}
        title="Switch user role mode"
      >
        {currentRole === 'OWNER' ? (
          <Shield className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
        )}
        <span className="hidden sm:inline text-[#a1a1aa]">Role:</span>
        <span className="font-bold">
          {currentRole === 'OWNER'
            ? 'Owner / Admin'
            : activeBroker
            ? `${activeBroker.name} (${activeBroker.code})`
            : 'Broker'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#18181b] shadow-2xl ring-1 ring-white/10 z-50 py-1.5 divide-y divide-[#27272a] border border-[#27272a] animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-[#71717a] uppercase">
              Switch Perspective
            </div>

            {/* Owner Option */}
            <div className="p-1">
              <button
                type="button"
                onClick={handleSelectOwner}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors ${
                  currentRole === 'OWNER'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-[#f4f4f5] hover:bg-[#27272a]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="font-semibold text-[#f4f4f5]">Owner / Admin</div>
                    <div className="text-[10px] text-[#a1a1aa] font-normal">Full revenue & ground control</div>
                  </div>
                </div>
                {currentRole === 'OWNER' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            </div>

            {/* Broker Options */}
            <div className="p-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[#71717a] uppercase">
                Active Brokers
              </div>
              {brokers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#71717a] italic">No brokers registered</div>
              ) : (
                brokers.map((broker) => {
                  const isSelected = currentRole === 'BROKER' && activeBrokerId === broker.id;
                  return (
                    <button
                      key={broker.id}
                      type="button"
                      onClick={() => handleSelectBroker(broker)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors mb-0.5 ${
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                          : 'text-[#f4f4f5] hover:bg-[#27272a]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#f4f4f5]">{broker.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono font-medium border border-emerald-500/30">
                              {broker.code}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#a1a1aa] font-normal">
                            Restricted operational view
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
