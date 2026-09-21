import React, { useState } from 'react';
import { Facility, FacilityType } from '../types';
import { formatCurrency } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { X, Plus, Trash2, Edit2, Check, Settings } from 'lucide-react';

interface FacilityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  facilities: Facility[];
  onSaveFacility: (fac: Partial<Facility> & { name: string; type: FacilityType; hourly_rate: number }) => Promise<void>;
  onDeleteFacility: (id: string) => Promise<void>;
}

export const FacilityManagerModal: React.FC<FacilityManagerModalProps> = ({
  isOpen,
  onClose,
  facilities,
  onSaveFacility,
  onDeleteFacility,
}) => {
  const { showToast } = useUIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<FacilityType>('NET');
  const [hourlyRate, setHourlyRate] = useState<number>(500);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartEdit = (fac: Facility) => {
    setEditingId(fac.id);
    setName(fac.name);
    setType(fac.type);
    setHourlyRate(fac.hourly_rate);
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setName('');
    setType('NET');
    setHourlyRate(500);
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSaveFacility({
      id: editingId || undefined,
      name: name.trim(),
      type,
      hourly_rate: Number(hourlyRate),
    });

    showToast(`🏟️ Facility "${name.trim()}" saved successfully!`, 'success');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: string, facName: string) => {
    if (window.confirm(`Are you sure you want to delete ${facName}?`)) {
      await onDeleteFacility(id);
      showToast(`🗑️ Facility "${facName}" removed.`, 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-[#f4f4f5] leading-none">
                Facilities & Pricing
              </h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Manage Grounds, Nets, and Hourly Rates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Add / Edit Form */}
          {(isAdding || editingId) && (
            <form onSubmit={handleSave} className="p-3.5 bg-[#18181b] border border-emerald-500/40 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">
                  {editingId ? 'Edit Facility' : 'Add New Facility'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setIsAdding(false);
                  }}
                  className="text-xs text-[#a1a1aa] hover:text-[#f4f4f5]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FacilityType)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5]"
                  >
                    <option value="GROUND">Ground</option>
                    <option value="NET">Regular Net</option>
                    <option value="TURF_NET">Turf Net</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    placeholder="e.g. Net 6"
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs text-[#f4f4f5]"
                    required
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-[#a1a1aa] mb-1">
                    Rate / Hour (₹)
                  </label>
                  <input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Facility</span>
              </button>
            </form>
          )}

          {/* List of Existing Facilities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#a1a1aa] px-1 font-semibold">
              <span>Active Facilities ({facilities.length})</span>
              {!isAdding && !editingId && (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Facility
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {facilities.map((fac) => (
                <div
                  key={fac.id}
                  className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between gap-3 hover:border-[#3f3f46] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                      fac.type === 'GROUND'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : fac.type === 'TURF_NET'
                        ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {fac.type}
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-[#f4f4f5]">
                      {fac.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono-numeric font-bold text-xs sm:text-sm text-emerald-400">
                      ₹{fac.hourly_rate}/hr
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(fac)}
                        className="p-1.5 rounded-md hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                        title="Edit Facility"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fac.id, fac.name)}
                        className="p-1.5 rounded-md hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors"
                        title="Delete Facility"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#18181b] border-t border-[#27272a] text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
