import { create } from 'zustand';
import { format } from 'date-fns';

import { UserRole } from '../types';

export interface QuickBookDraft {
  facilityId?: string;
  date?: string;
  startTime?: string;
  durationMins?: number;
  customerPhone?: string;
  customerName?: string;
  teamAName?: string;
  teamBName?: string;
  brokerId?: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  durationMs?: number;
}

interface UIStoreState {
  selectedDate: string; // YYYY-MM-DD
  isQuickBookOpen: boolean;
  quickBookDraft: QuickBookDraft | null;
  activeBookingDetailId: string | null;
  activeCollectPaymentBookingId: string | null;
  isFacilityManagerOpen: boolean;
  mobileViewMode: 'runsheet' | 'matrix';
  toast: ToastNotification | null;

  // Role System
  currentRole: UserRole;
  activeBrokerId: string | null; // e.g. "br-1"

  // Actions
  setSelectedDate: (date: string) => void;
  openQuickBook: (draft?: QuickBookDraft) => void;
  closeQuickBook: () => void;
  openBookingDetail: (bookingId: string) => void;
  closeBookingDetail: () => void;
  openCollectPayment: (bookingId: string) => void;
  closeCollectPayment: () => void;
  openFacilityManager: () => void;
  closeFacilityManager: () => void;
  setMobileViewMode: (mode: 'runsheet' | 'matrix') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info', durationMs?: number) => void;
  clearToast: () => void;
  setUserRole: (role: UserRole, brokerId?: string | null) => void;
  setActiveBroker: (brokerId: string) => void;
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  isQuickBookOpen: false,
  quickBookDraft: null,
  activeBookingDetailId: null,
  activeCollectPaymentBookingId: null,
  isFacilityManagerOpen: false,
  mobileViewMode: 'runsheet',
  toast: null,
  currentRole: 'OWNER',
  activeBrokerId: 'br-1', // Default selected broker profile when switching to broker mode

  setSelectedDate: (date) => set({ selectedDate: date }),
  openQuickBook: (draft) => set({ isQuickBookOpen: true, quickBookDraft: draft || null }),
  closeQuickBook: () => set({ isQuickBookOpen: false, quickBookDraft: null }),
  openBookingDetail: (bookingId) => set({ activeBookingDetailId: bookingId }),
  closeBookingDetail: () => set({ activeBookingDetailId: null }),
  openCollectPayment: (bookingId) => set({ activeCollectPaymentBookingId: bookingId }),
  closeCollectPayment: () => set({ activeCollectPaymentBookingId: null }),
  openFacilityManager: () => set({ isFacilityManagerOpen: true }),
  closeFacilityManager: () => set({ isFacilityManagerOpen: false }),
  setMobileViewMode: (mode) => set({ mobileViewMode: mode }),
  showToast: (message: string, type: 'success' | 'error' | 'info' = 'success', durationMs: number = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    set({ toast: { id, message, type, durationMs } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, durationMs);
  },
  clearToast: () => set({ toast: null }),
  setUserRole: (role, brokerId) => set((state) => ({
    currentRole: role,
    activeBrokerId: role === 'BROKER' ? (brokerId || state.activeBrokerId || 'br-1') : state.activeBrokerId,
  })),
  setActiveBroker: (brokerId) => set({ activeBrokerId: brokerId, currentRole: 'BROKER' }),
}));
