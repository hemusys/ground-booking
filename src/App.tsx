import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardPage } from './pages/DashboardPage';
import { DueCollectionsPage } from './pages/DueCollectionsPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { CalendarPage } from './pages/CalendarPage';
import { BookingsPage } from './pages/BookingsPage';
import { useUIStore } from './stores/useUIStore';
import { 
  fetchFacilities, 
  fetchBookings, 
  fetchDueBookings, 
  fetchCustomerSummaries, 
  fetchDailyStats 
} from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: true,
    },
  },
});

import { ToastNotificationBanner } from './components/ui/ToastNotification';

function AppContent() {
  const { selectedDate } = useUIStore();
  const queryClient = useQueryClient();

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: fetchFacilities,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedDate],
    queryFn: () => fetchBookings(selectedDate),
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['allBookings'],
    queryFn: () => fetchBookings(),
  });

  const { data: dueBookings = [] } = useQuery({
    queryKey: ['dueBookings'],
    queryFn: fetchDueBookings,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomerSummaries(),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ['dailyStats', selectedDate],
    queryFn: () => fetchDailyStats(selectedDate),
  });

  const handleRefetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['facilities'] }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['allBookings'] }),
      queryClient.invalidateQueries({ queryKey: ['dueBookings'] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['dailyStats'] }),
    ]);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col selection:bg-emerald-500/20 selection:text-emerald-400">
      <ToastNotificationBanner />
      <Header
        stats={dailyStats}
        dueCount={dueBookings.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                facilities={facilities}
                bookings={bookings}
                refetch={handleRefetchAll}
              />
            }
          />
          <Route
            path="/calendar"
            element={
              <CalendarPage
                facilities={facilities}
                bookings={allBookings}
                refetch={handleRefetchAll}
              />
            }
          />
          <Route
            path="/calendar/:date"
            element={
              <CalendarPage
                facilities={facilities}
                bookings={allBookings}
                refetch={handleRefetchAll}
              />
            }
          />
          <Route
            path="/bookings"
            element={
              <BookingsPage
                facilities={facilities}
                bookings={allBookings}
                refetch={handleRefetchAll}
              />
            }
          />
          <Route
            path="/due"
            element={
              <DueCollectionsPage
                dueBookings={dueBookings}
                refetch={handleRefetchAll}
              />
            }
          />
          <Route
            path="/customers"
            element={
              <CustomersPage
                customers={customers}
              />
            }
          />
          <Route
            path="/customers/:id"
            element={
              <CustomerProfilePage
                refetchAll={handleRefetchAll}
              />
            }
          />
          <Route
            path="/reconciliation"
            element={
              <ReconciliationPage
                refetchAll={handleRefetchAll}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav dueCount={dueBookings.length} />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
