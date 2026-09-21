export type FacilityType = 'GROUND' | 'NET' | 'TURF_NET';
export type PaymentMethod = 'UPI' | 'CASH' | 'CARD';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'FULLY_PAID';

export type RepeatType = 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM_WEEKDAYS';
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type AuditLogAction = 
  | 'BOOKING_CREATED'
  | 'BOOKING_EDITED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_COLLECTED'
  | 'DUE_AMOUNT_CHANGED'
  | 'CONFLICT_OVERRIDE'
  | 'RECONCILIATION_CLOSED'
  | 'RECONCILIATION_EDITED'
  | 'CUSTOMER_BLACKLIST_TOGGLED';

export interface BookingAuditLog {
  id: string;
  booking_id: string;
  action_type: AuditLogAction;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  performed_by: string;
  created_at: string;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  hourly_rate: number;
  display_order: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  team_name?: string | null;
  notes?: string | null;
  is_blacklisted?: boolean;
  blacklist_reason?: string | null;
  created_at?: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string | null;
  payment_notes?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface RecurringBookingGroup {
  id: string;
  name: string;
  repeat_type: RepeatType;
  weekdays: Weekday[];
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_number?: number;
  facility_id: string;
  customer_id: string;
  booking_date: string; // YYYY-MM-DD (Timezone hardened local date)
  start_time: string;   // ISO 8601 string
  end_time: string;     // ISO 8601 string
  total_amount: number;
  custom_pending_amount?: number | null;
  pending_adjustment_reason?: string | null;
  allow_due_override?: boolean;
  is_conflict_override?: boolean;
  recurring_group_id?: string | null;
  notes?: string | null;
  is_cancelled: boolean;
  created_at: string;
  updated_at?: string;
  
  // Computed / Joined fields
  facility?: Facility;
  customer?: Customer;
  payments?: Payment[];
  audit_logs?: BookingAuditLog[];
  recurring_group?: RecurringBookingGroup;
  total_paid?: number;
  pending_amount?: number;
  payment_status?: PaymentStatus;
}

export interface QuickBookFormData {
  facility_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  customer_phone: string;
  customer_name: string;
  team_name?: string;
  total_amount: number;
  advance_paid: number;
  custom_pending_amount?: number | null;
  pending_adjustment_reason?: string | null;
  allow_due_override?: boolean;
  is_conflict_override?: boolean;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  notes?: string;

  // Recurring Bookings
  repeat_type?: RepeatType;
  repeat_end_date?: string;
  repeat_weekdays?: Weekday[];
  recurring_group_name?: string;

  // Blacklist Override
  allow_blacklist_override?: boolean;
}

export interface EditBookingFormData {
  booking_id: string;
  facility_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  customer_phone: string;
  customer_name: string;
  team_name?: string;
  total_amount: number;
  custom_pending_amount?: number | null;
  pending_adjustment_reason?: string | null;
  allow_due_override?: boolean;
  is_conflict_override?: boolean;
  notes?: string;

  // Series Edit Mode
  edit_series_mode?: 'THIS_ONLY' | 'FUTURE_SERIES';
}

export interface RecurrenceConflictItem {
  date: string;
  startTime: string;
  endTime: string;
  conflictingBooking: Booking;
}

export interface RecurrenceConflictResult {
  totalRequested: number;
  availableDates: string[];
  conflicts: RecurrenceConflictItem[];
}

export type BookingStatusFilter = 
  | 'ALL' 
  | 'TODAY' 
  | 'TOMORROW' 
  | 'UPCOMING' 
  | 'PAST' 
  | 'PENDING_PAYMENT' 
  | 'PARTIALLY_PAID' 
  | 'FULLY_PAID' 
  | 'CANCELLED';

export interface BookingSearchFilters {
  searchQuery: string;
  statusFilter: BookingStatusFilter;
  facilityId: string; // 'ALL' or specific facility ID
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface CustomerSummary extends Customer {
  booking_count: number;
  total_spent: number;
  total_pending: number;
  last_booking_date?: string;
  reliability_score?: number; // 0 to 100%
  bookings: Booking[];
}

export interface DailyStats {
  totalBookings: number;
  collectedToday: number;
  pendingToday: number;
  upiCollected: number;
  cashCollected: number;
}

export interface ReminderRecipient {
  bookingId: string;
  customerName: string;
  phone: string;
  facilityName: string;
  dateStr: string;
  timeStr: string;
  pendingAmount: number;
  totalAmount: number;
  advancePaid: number;
  whatsAppUrl: string;
}

export interface DailyReconciliation {
  id: string;
  date: string; // YYYY-MM-DD
  cash_expected: number;
  cash_actual: number;
  upi_expected: number;
  upi_actual: number;
  card_expected: number;
  card_actual: number;
  variance: number;
  status: 'CLOSED' | 'VARIANCE_FOUND';
  notes?: string | null;
  closed_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationReportMetrics {
  totalVariance: number;
  totalDaysClosed: number;
  daysWithMismatch: number;
  totalExpected: number;
  totalActual: number;
}
