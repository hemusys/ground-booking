import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { formatCurrency } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { X, CheckCircle2, QrCode, CreditCard, Banknote, AlertCircle } from 'lucide-react';

interface CollectPaymentModalProps {
  booking: Booking | null;
  onClose: () => void;
  onCollect: (
    bookingId: string,
    amount: number,
    method: 'UPI' | 'CASH' | 'CARD',
    notes?: string,
    transactionReference?: string
  ) => Promise<void>;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({
  booking,
  onClose,
  onCollect,
}) => {
  const { showToast } = useUIStore();
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('Final balance settlement');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setAmount(booking.pending_amount || 0);
      setTransactionReference('');
      setErrorMessage(null);
      setNotes(method === 'CASH' ? 'Cash collected at desk' : 'Electronic balance settlement');
    }
  }, [booking, method]);

  if (!booking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (amount <= 0) {
      setErrorMessage('Please enter a payment amount greater than ₹0.');
      return;
    }

    if ((method === 'UPI' || method === 'CARD') && !transactionReference.trim()) {
      setErrorMessage(`Please enter the ${method === 'UPI' ? 'UPI Reference / UTR Number' : 'Card Authorization / Transaction ID'}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCollect(
        booking.id, 
        amount, 
        method, 
        notes.trim() || undefined, 
        transactionReference.trim() || undefined
      );
      showToast(`💵 Payment of ${formatCurrency(amount)} recorded successfully!`, 'success');
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to record payment.');
      showToast(err?.message || 'Failed to record payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingAfterPayment = Math.max(0, (booking.pending_amount || 0) - amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-[#09090b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#18181b] border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#f4f4f5] leading-none">
              Collect Payment
            </h3>
            <p className="text-xs text-[#a1a1aa] mt-1">
              {booking.customer?.name} • {booking.facility?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[#a1a1aa] block">Current Balance Due</span>
              <span className="font-bold font-mono-numeric text-base text-amber-400">
                {formatCurrency(booking.pending_amount || 0)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAmount(booking.pending_amount || 0)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
            >
              Collect Full Due
            </button>
          </div>

          {/* Amount to Collect */}
          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
              Amount to Collect (₹)
            </label>
            <input
              type="number"
              min="1"
              value={amount || ''}
              placeholder="0"
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-base font-bold font-mono text-emerald-400 focus:outline-hidden focus:border-emerald-500"
              required
            />
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod('UPI')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  method === 'UPI'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  method === 'CASH'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('CARD')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  method === 'CARD'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'bg-[#18181b] text-[#a1a1aa] border border-[#27272a] hover:text-[#f4f4f5]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
            </div>
          </div>

          {/* Feature 2: Payment Reference Input for UPI / Card */}
          {(method === 'UPI' || method === 'CARD') && (
            <div className="animate-in fade-in space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#a1a1aa]">
                  {method === 'UPI' ? 'UPI Ref / UTR / Txn ID' : 'Card Authorization / Slip No.'}
                </label>
                <span className="text-[10px] text-amber-400 font-medium">Required for reconciliation</span>
              </div>
              <input
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder={method === 'UPI' ? 'e.g. UPI/628192839120 or 12-digit UTR' : 'e.g. POS-AUTH-9281'}
                className="w-full bg-[#18181b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-mono text-[#f4f4f5] focus:outline-hidden"
                required
              />
            </div>
          )}

          {/* Payment Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">
              {method === 'CASH' ? 'Cash Collection Note (Optional)' : 'Payment Notes (Optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={method === 'CASH' ? 'e.g. Received at desk from coach' : 'e.g. GPay scan on counter QR'}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {/* Balance Preview */}
          <div className="text-xs flex items-center justify-between text-[#a1a1aa] pt-1">
            <span>Balance after payment:</span>
            <span className={`font-mono font-bold ${
              remainingAfterPayment === 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {remainingAfterPayment === 0 ? '₹0 (Fully Settled ✅)' : formatCurrency(remainingAfterPayment)}
            </span>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || amount <= 0}
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Record Payment of {formatCurrency(amount)}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
