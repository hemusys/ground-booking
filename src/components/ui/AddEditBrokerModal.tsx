import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, Phone, User, FileText, CheckCircle2 } from 'lucide-react';
import { Broker } from '../../types';
import { saveBroker } from '../../lib/api';
import { useUIStore } from '../../stores/useUIStore';

interface AddEditBrokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerToEdit?: Broker | null;
  onSaved: (broker: Broker) => void;
}

export const AddEditBrokerModal: React.FC<AddEditBrokerModalProps> = ({
  isOpen,
  onClose,
  brokerToEdit,
  onSaved,
}) => {
  const { showToast } = useUIStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (brokerToEdit) {
      setName(brokerToEdit.name || '');
      setPhone(brokerToEdit.phone || '');
      setNotes(brokerToEdit.notes || '');
    } else {
      setName('');
      setPhone('');
      setNotes('');
    }
    setError(null);
  }, [brokerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Broker name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact phone number is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const saved = await saveBroker({
        id: brokerToEdit?.id,
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || null,
        is_active: brokerToEdit ? brokerToEdit.is_active : true,
      });

      showToast(
        brokerToEdit
          ? `Broker ${saved.name} updated successfully`
          : `Broker ${saved.name} (${saved.code}) registered successfully`,
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save broker');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {brokerToEdit ? 'Edit Broker' : 'Register New Broker'}
              </h3>
              <p className="text-xs text-emerald-100">
                {brokerToEdit ? `Code: ${brokerToEdit.code}` : 'System assigns sequential code (BRK-00X)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Broker Code Notice */}
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <span className="font-medium">Assigned Code:</span>
            <span className="font-mono font-bold bg-white px-2.5 py-1 rounded-md shadow-xs border border-emerald-200">
              {brokerToEdit ? brokerToEdit.code : 'Auto-Generated (BRK-00X)'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Broker Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9811223344"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Weekend match organizer, corporate leagues..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                'Saving...'
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  {brokerToEdit ? 'Update Broker' : 'Register Broker'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
