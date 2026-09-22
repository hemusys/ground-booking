import React, { useState, useEffect, useMemo } from 'react';
import { Broker, BrokerOperationalReportItem, Booking } from '../types';
import { fetchBrokers, toggleBrokerStatus, fetchBrokerOperationalReport } from '../lib/api';
import { AddEditBrokerModal } from '../components/ui/AddEditBrokerModal';
import { useUIStore } from '../stores/useUIStore';
import {
  Users,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Phone,
  BarChart3,
  List,
  Clock,
  Building,
  Shield,
  Search,
} from 'lucide-react';

interface BrokersPageProps {
  bookings: Booking[];
}

export const BrokersPage: React.FC<BrokersPageProps> = ({ bookings }) => {
  const { currentRole } = useUIStore();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [activeTab, setActiveTab] = useState<'directory' | 'report'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrokerForEdit, setSelectedBrokerForEdit] = useState<Broker | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [reportItems, setReportItems] = useState<BrokerOperationalReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const brokerList = await fetchBrokers();
      setBrokers(brokerList);
      const report = await fetchBrokerOperationalReport();
      setReportItems(report);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [bookings]);

  const handleToggleStatus = async (brokerId: string) => {
    await toggleBrokerStatus(brokerId);
    await loadData();
  };

  const filteredBrokers = useMemo(() => {
    return brokers.filter(
      (b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.phone.includes(searchQuery)
    );
  }, [brokers, searchQuery]);

  if (currentRole === 'BROKER') {
    return (
      <div className="p-8 text-center bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3 my-6 max-w-lg mx-auto">
        <Shield className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-[#f4f4f5]">Restricted Access</h3>
        <p className="text-xs text-[#a1a1aa]">
          Broker Management & Partner Directories are restricted to Ground Owners and Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Users className="w-4 h-4" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-[#f4f4f5]">
              Broker & Partner Management
            </h1>
          </div>
          <p className="text-xs text-[#a1a1aa]">
            Manage external booking agents, assign broker codes, and track operational volume.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Broker</span>
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#27272a] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'directory'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Broker Directory ({brokers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'report'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Operational Report</span>
        </button>
      </div>

      {/* TAB 1: BROKER DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brokers by name, code (e.g. BRK-001) or phone..."
              className="w-full bg-[#18181b] border border-[#27272a] rounded-xl pl-9 pr-4 py-2 text-sm text-[#f4f4f5] focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          {filteredBrokers.length === 0 ? (
            <div className="p-8 text-center bg-[#18181b] border border-[#27272a] rounded-2xl text-xs text-[#71717a]">
              No brokers found. Click "Add Broker" to register a partner.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBrokers.map((broker) => (
                <div
                  key={broker.id}
                  className={`p-4 rounded-xl border bg-[#18181b] transition-all space-y-3 shadow-md ${
                    broker.is_active ? 'border-[#27272a] hover:border-zinc-500' : 'border-rose-950 opacity-60 bg-zinc-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                        {broker.code}
                      </span>
                      <h3 className="text-sm font-bold text-[#f4f4f5] pt-1">
                        {broker.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        broker.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {broker.is_active ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" /> Disabled
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-[#a1a1aa] flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+91 {broker.phone}</span>
                  </div>

                  {broker.notes && (
                    <p className="text-[11px] text-[#71717a] italic line-clamp-2">
                      "{broker.notes}"
                    </p>
                  )}

                  <div className="pt-2 border-t border-[#27272a] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(broker.id)}
                      className={`text-[11px] font-semibold transition-colors ${
                        broker.is_active
                          ? 'text-rose-400 hover:text-rose-300'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      {broker.is_active ? 'Disable Broker' : 'Activate Broker'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBrokerForEdit(broker)}
                      className="px-2.5 py-1 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-[#f4f4f5] text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OPERATIONAL REPORT (No Ranking, No Leaderboards) */}
      {activeTab === 'report' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-[#121214] border-b border-[#27272a]">
            <h3 className="text-sm font-bold text-[#f4f4f5]">
              Broker Operational Report
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Standard operational tracking for partner bookings and ground usage duration.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#09090b] text-[#a1a1aa] border-b border-[#27272a] font-semibold">
                <tr>
                  <th className="p-3">Broker Code</th>
                  <th className="p-3">Broker Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3 text-right">Total Bookings</th>
                  <th className="p-3 text-right">Total Hours Booked</th>
                  <th className="p-3 text-right">This Month Bookings</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] text-[#f4f4f5]">
                {reportItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#71717a]">
                      No broker operational data available.
                    </td>
                  </tr>
                ) : (
                  reportItems.map((item) => (
                    <tr key={item.broker_id} className="hover:bg-[#18181b]/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {item.broker_code}
                      </td>
                      <td className="p-3 font-bold">
                        {item.broker_name}
                      </td>
                      <td className="p-3 font-mono text-[#a1a1aa]">
                        +91 {item.phone}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {item.total_bookings}
                      </td>
                      <td className="p-3 text-right font-mono text-cyan-400 font-semibold">
                        {item.total_hours_booked} hrs
                      </td>
                      <td className="p-3 text-right font-mono text-purple-400 font-semibold">
                        {item.this_month_bookings}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {item.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Broker Modals */}
      {isAddModalOpen && (
        <AddEditBrokerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSaved={async () => {
            setIsAddModalOpen(false);
            await loadData();
          }}
        />
      )}

      {selectedBrokerForEdit && (
        <AddEditBrokerModal
          isOpen={Boolean(selectedBrokerForEdit)}
          brokerToEdit={selectedBrokerForEdit}
          onClose={() => setSelectedBrokerForEdit(null)}
          onSaved={async () => {
            setSelectedBrokerForEdit(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
};
