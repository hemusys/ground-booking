import React, { useState, useEffect } from 'react';
import { 
  fetchDailyReconciliation, 
  fetchReconciliationHistory, 
  saveDailyReconciliation, 
  computeReconciliationExpected,
  computeReconciliationMetrics
} from '../lib/api';
import { DailyReconciliation, ReconciliationReportMetrics } from '../types';
import { formatCurrency, formatDateDisplay } from '../lib/utils';
import { useUIStore } from '../stores/useUIStore';
import { 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  DollarSign, 
  QrCode, 
  CreditCard, 
  Banknote, 
  History, 
  Filter, 
  Save 
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

interface ReconciliationPageProps {
  refetchAll?: () => Promise<void>;
}

export const ReconciliationPage: React.FC<ReconciliationPageProps> = ({ refetchAll }) => {
  const { selectedDate, setSelectedDate, showToast } = useUIStore();

  const [activeDate, setActiveDate] = useState<string>(selectedDate || format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'closing' | 'reports'>('closing');

  // Expected figures for active date
  const [expected, setExpected] = useState<{ cash: number; upi: number; card: number; total: number }>({
    cash: 0,
    upi: 0,
    card: 0,
    total: 0,
  });

  // Current record for active date
  const [currentRecord, setCurrentRecord] = useState<DailyReconciliation | null>(null);

  // Form Inputs
  const [actualCash, setActualCash] = useState<number | ''>('');
  const [actualUpi, setActualUpi] = useState<number | ''>('');
  const [actualCard, setActualCard] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Reports State
  const [historyList, setHistoryList] = useState<DailyReconciliation[]>([]);
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [reportMetrics, setReportMetrics] = useState<ReconciliationReportMetrics>({
    totalVariance: 0,
    totalDaysClosed: 0,
    daysWithMismatch: 0,
    totalExpected: 0,
    totalActual: 0,
  });

  // Load expected figures and reconciliation record for selected activeDate
  const loadDateData = async (dateStr: string) => {
    const exp = await computeReconciliationExpected(dateStr);
    setExpected(exp);

    const rec = await fetchDailyReconciliation(dateStr);
    setCurrentRecord(rec);

    if (rec) {
      setActualCash(rec.cash_actual);
      setActualUpi(rec.upi_actual);
      setActualCard(rec.card_actual);
      setNotes(rec.notes || '');
    } else {
      // Auto-fill actuals with expected defaults for frictionless closing
      setActualCash(exp.cash);
      setActualUpi(exp.upi);
      setActualCard(exp.card);
      setNotes('');
    }
  };

  const loadHistory = async () => {
    const records = await fetchReconciliationHistory(
      reportStartDate || undefined,
      reportEndDate || undefined
    );
    setHistoryList(records);
    setReportMetrics(computeReconciliationMetrics(records));
  };

  useEffect(() => {
    loadDateData(activeDate);
  }, [activeDate]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadHistory();
    }
  }, [activeTab, reportStartDate, reportEndDate]);

  // Compute live variances
  const cashCounted = typeof actualCash === 'number' ? actualCash : 0;
  const upiCounted = typeof actualUpi === 'number' ? actualUpi : 0;
  const cardCounted = typeof actualCard === 'number' ? actualCard : 0;

  const actualTotal = cashCounted + upiCounted + cardCounted;
  const totalVariance = actualTotal - expected.total;
  const cashVariance = cashCounted - expected.cash;
  const upiVariance = upiCounted - expected.upi;
  const cardVariance = cardCounted - expected.card;

  const handleSaveClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccessMessage(null);

    const status = totalVariance === 0 ? 'CLOSED' : 'VARIANCE_FOUND';

    try {
      const saved = await saveDailyReconciliation({
        date: activeDate,
        cash_expected: expected.cash,
        cash_actual: cashCounted,
        upi_expected: expected.upi,
        upi_actual: upiCounted,
        card_expected: expected.card,
        card_actual: cardCounted,
        variance: totalVariance,
        status,
        notes: notes.trim() || undefined,
        closed_by: 'Ground Manager',
      });

      setCurrentRecord(saved);
      setSaveSuccessMessage('Daily reconciliation recorded and ledger closed successfully!');
      showToast('⚖️ Daily register closed and saved successfully!', 'success');
      if (refetchAll) await refetchAll();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save daily closing.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const twoDaysAgoStr = format(subDays(new Date(), 2), 'yyyy-MM-dd');

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#18181b] p-4 sm:p-5 rounded-2xl border border-[#27272a] shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            <span>End of Day Reconciliation</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#f4f4f5] mt-1">
            Cash & Digital Audit Ledger
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Detect cash leakages and reconcile register balances against physical collections.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-[#09090b] border border-[#27272a] p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('closing')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'closing'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Daily Closing</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'reports'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Reports</span>
          </button>
        </div>
      </div>

      {activeTab === 'closing' ? (
        <div className="space-y-4">
          {/* Quick Date Chips Bar */}
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#71717a]">
                Quick Date Presets:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'Today', date: todayStr },
                  { label: 'Yesterday', date: yesterdayStr },
                  { label: '2 Days Ago', date: twoDaysAgoStr },
                ].map((preset) => {
                  const isSelected = activeDate === preset.date;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setActiveDate(preset.date);
                        setSelectedDate(preset.date);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-xs'
                          : 'bg-[#09090b] text-[#a1a1aa] border-[#27272a] hover:bg-[#27272a] hover:text-[#f4f4f5]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-semibold text-[#a1a1aa]">
                Custom Date:
              </label>
              <input
                type="date"
                value={activeDate}
                onChange={(e) => {
                  setActiveDate(e.target.value);
                  setSelectedDate(e.target.value);
                }}
                className="bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-2.5 py-1 text-xs text-[#f4f4f5] font-mono focus:outline-hidden"
              />
            </div>
          </div>

          {/* Closing Status Banner */}
          <div className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <span>Selected Audit Date: </span>
              <span className="font-bold text-[#f4f4f5] font-mono">
                {formatDateDisplay(`${activeDate}T12:00:00`)}
              </span>
            </div>

            <div>
              {currentRecord ? (
                <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  currentRecord.variance === 0
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {currentRecord.variance === 0 
                      ? 'Register Closed (Balanced ✅)' 
                      : `Closed with Variance (${formatCurrency(currentRecord.variance)})`}
                  </span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Register Not Closed for This Date</span>
                </div>
              )}
            </div>
          </div>

          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Expected vs Actual Breakdown */}
          <form onSubmit={handleSaveClosing} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cash Box */}
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">
                      Cash In Register
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Drawer Count</span>
                </div>

                <div className="p-2.5 bg-[#09090b] rounded-xl border border-[#27272a] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Expected:</span>
                    <span className="font-mono font-bold text-[#f4f4f5]">{formatCurrency(expected.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Cash Counted:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(cashCounted)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#27272a]">
                    <span>Variance:</span>
                    <span className={`font-mono font-bold ${
                      cashVariance === 0 ? 'text-emerald-400' : cashVariance > 0 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {cashVariance > 0 ? `+${formatCurrency(cashVariance)}` : formatCurrency(cashVariance)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#a1a1aa] font-semibold mb-1">
                    Actual Cash Counted (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* UPI Settlements */}
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">
                      UPI Statement
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Bank App Total</span>
                </div>

                <div className="p-2.5 bg-[#09090b] rounded-xl border border-[#27272a] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Expected:</span>
                    <span className="font-mono font-bold text-[#f4f4f5]">{formatCurrency(expected.upi)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>UPI Received:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(upiCounted)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#27272a]">
                    <span>Variance:</span>
                    <span className={`font-mono font-bold ${
                      upiVariance === 0 ? 'text-emerald-400' : upiVariance > 0 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {upiVariance > 0 ? `+${formatCurrency(upiVariance)}` : formatCurrency(upiVariance)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#a1a1aa] font-semibold mb-1">
                    Actual UPI Total (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actualUpi}
                    onChange={(e) => setActualUpi(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              {/* Card / POS Terminals */}
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#f4f4f5]">
                      Card POS Batch
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Terminal Settlement</span>
                </div>

                <div className="p-2.5 bg-[#09090b] rounded-xl border border-[#27272a] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Expected:</span>
                    <span className="font-mono font-bold text-[#f4f4f5]">{formatCurrency(expected.card)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
                    <span>Card Settled:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(cardCounted)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#27272a]">
                    <span>Variance:</span>
                    <span className={`font-mono font-bold ${
                      cardVariance === 0 ? 'text-emerald-400' : cardVariance > 0 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {cardVariance > 0 ? `+${formatCurrency(cardVariance)}` : formatCurrency(cardVariance)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#a1a1aa] font-semibold mb-1">
                    Actual Card Batch (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={actualCard}
                    onChange={(e) => setActualCard(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg px-3 py-2 text-sm font-bold font-mono text-emerald-400 focus:outline-hidden"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Total Balance Variance Summary Bar */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md ${
              totalVariance === 0 
                ? 'bg-emerald-950/30 border-emerald-500/40' 
                : totalVariance < 0 
                ? 'bg-rose-950/30 border-rose-500/50' 
                : 'bg-amber-950/30 border-amber-500/50'
            }`}>
              <div>
                <div className="text-xs text-[#a1a1aa] uppercase font-bold tracking-wider">
                  Total Day Variance
                </div>
                <div className={`text-2xl sm:text-3xl font-black font-mono-numeric mt-0.5 ${
                  totalVariance === 0 ? 'text-emerald-400' : totalVariance < 0 ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  {totalVariance > 0 ? `+${formatCurrency(totalVariance)}` : formatCurrency(totalVariance)}
                </div>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Expected Gross: <span className="font-mono font-bold text-zinc-300">{formatCurrency(expected.total)}</span> • Actual Counted: <span className="font-mono font-bold text-zinc-300">{formatCurrency(actualTotal)}</span>
                </p>
              </div>

              <div className="text-xs sm:text-right">
                <span className={`px-3 py-1 rounded-full font-bold border inline-block ${
                  totalVariance === 0 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : totalVariance < 0 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {totalVariance === 0 ? 'Balanced Register (0 Error)' : totalVariance < 0 ? 'Cash Shortage Detected' : 'Surplus Received'}
                </span>
              </div>
            </div>

            {/* Closing Notes */}
            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-2">
              <label className="block text-xs font-semibold text-[#a1a1aa]">
                Manager Closing Notes / Variance Explanation
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. ₹500 cash drawer float retained for next morning shift / UPI batch matched with bank statement."
                rows={2}
                className="w-full bg-[#09090b] border border-[#27272a] focus:border-emerald-500 rounded-lg p-2.5 text-xs text-[#f4f4f5] focus:outline-hidden"
              />
            </div>

            {/* Action Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center gap-2 shadow-lg transition-all"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>{currentRecord ? 'Update Daily Closing' : 'Close Register & Save Audit'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Reports & History Section */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <Filter className="w-4 h-4 text-emerald-400" />
              <span>Date Filter:</span>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-xs text-[#f4f4f5] font-mono focus:outline-hidden"
              />
              <span>to</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="bg-[#09090b] border border-[#27272a] rounded-lg px-2 py-1 text-xs text-[#f4f4f5] font-mono focus:outline-hidden"
              />
            </div>

            {(reportStartDate || reportEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setReportStartDate('');
                  setReportEndDate('');
                }}
                className="text-xs text-emerald-400 hover:underline"
              >
                Clear Range
              </button>
            )}
          </div>

          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
                Total Closed Days
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-[#f4f4f5] mt-1 block">
                {reportMetrics.totalDaysClosed}
              </span>
            </div>

            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
                Days with Mismatch
              </span>
              <span className={`text-xl sm:text-2xl font-bold font-mono mt-1 block ${
                reportMetrics.daysWithMismatch > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {reportMetrics.daysWithMismatch}
              </span>
            </div>

            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
                Cumulative Variance
              </span>
              <span className={`text-xl sm:text-2xl font-bold font-mono mt-1 block ${
                reportMetrics.totalVariance === 0 ? 'text-emerald-400' : reportMetrics.totalVariance < 0 ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {formatCurrency(reportMetrics.totalVariance)}
              </span>
            </div>

            <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl">
              <span className="text-[10px] text-[#a1a1aa] uppercase font-bold tracking-wider block">
                Total Actual Settled
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {formatCurrency(reportMetrics.totalActual)}
              </span>
            </div>
          </div>

          {/* Reconciliation History Table */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-md">
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Historical Closing Records ({historyList.length})</span>
              </h3>
            </div>

            {historyList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#71717a]">
                No daily reconciliations found in this range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121214] text-[#a1a1aa] uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Expected</th>
                      <th className="p-3.5">Actual Counted</th>
                      <th className="p-3.5">Variance</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Notes</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {historyList.map((r) => {
                      const expTot = Number(r.cash_expected) + Number(r.upi_expected) + Number(r.card_expected);
                      const actTot = Number(r.cash_actual) + Number(r.upi_actual) + Number(r.card_actual);

                      return (
                        <tr key={r.id} className="hover:bg-[#27272a]/40 transition-colors">
                          <td className="p-3.5 font-bold font-mono text-[#f4f4f5]">
                            {formatDateDisplay(r.date)}
                          </td>
                          <td className="p-3.5 font-mono text-[#a1a1aa]">
                            {formatCurrency(expTot)}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-400">
                            {formatCurrency(actTot)}
                          </td>
                          <td className="p-3.5 font-mono font-bold">
                            <span className={r.variance === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {r.variance > 0 ? `+${formatCurrency(r.variance)}` : formatCurrency(r.variance)}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              r.variance === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#a1a1aa] max-w-xs truncate">
                            {r.notes || '—'}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDate(r.date);
                                setActiveTab('closing');
                              }}
                              className="px-2.5 py-1 rounded bg-[#27272a] hover:bg-[#3f3f46] text-xs font-medium text-emerald-400 transition-colors"
                            >
                              Inspect / Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
