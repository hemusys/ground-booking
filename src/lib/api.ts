import { supabase, isSupabaseConfigured } from './supabase';
import { 
  Facility, 
  Customer, 
  Booking, 
  Payment, 
  BookingAuditLog,
  AuditLogAction,
  QuickBookFormData, 
  EditBookingFormData,
  BookingSearchFilters,
  CustomerSummary, 
  PaymentStatus, 
  DailyStats,
  RepeatType,
  Weekday,
  RecurringBookingGroup,
  RecurrenceConflictResult,
  RecurrenceConflictItem,
  DailyReconciliation,
  ReconciliationReportMetrics,
  Broker,
  BrokerStats,
  BrokerOperationalReportItem,
  UserRole,
  BookingSource,
  DiscountType,
  DiscountReason
} from '../types';
import { 
  format, 
  parseISO, 
  areIntervalsOverlapping, 
  isToday, 
  isTomorrow, 
  startOfDay, 
  endOfDay, 
  addDays, 
  isBefore,
  getDay,
  eachDayOfInterval
} from 'date-fns';
import { createSafeBookingInterval } from './time';

const STORAGE_KEY_FACILITIES = 'gm_facilities_v2';
const STORAGE_KEY_CUSTOMERS = 'gm_customers_v2';
const STORAGE_KEY_BOOKINGS = 'gm_bookings_v2';
const STORAGE_KEY_PAYMENTS = 'gm_payments_v2';
const STORAGE_KEY_AUDIT_LOGS = 'gm_audit_logs_v2';
const STORAGE_KEY_RECURRING_GROUPS = 'gm_recurring_groups_v2';
const STORAGE_KEY_RECONCILIATIONS = 'gm_reconciliations_v2';
const STORAGE_KEY_BROKERS = 'gm_brokers_v2';

export const DEFAULT_BROKERS: Broker[] = [
  { id: 'br-1', name: 'Rajesh Sharma', phone: '9811223344', code: 'BRK-001', notes: 'Weekend match organizer', is_active: true, created_at: new Date().toISOString() },
  { id: 'br-2', name: 'Sunil Verma', phone: '9822334455', code: 'BRK-002', notes: 'Corporate tournament coordinator', is_active: true, created_at: new Date().toISOString() },
  { id: 'br-3', name: 'Deepak Patel', phone: '9833445566', code: 'BRK-003', notes: 'Under-19 club matches', is_active: true, created_at: new Date().toISOString() },
];

const DEFAULT_FACILITIES: Facility[] = [
  { id: 'f-1', name: 'Main Ground', type: 'GROUND', hourly_rate: 1500, display_order: 1, is_active: true },
  { id: 'f-2', name: 'Net 1', type: 'NET', hourly_rate: 500, display_order: 2, is_active: true },
  { id: 'f-3', name: 'Net 2', type: 'NET', hourly_rate: 500, display_order: 3, is_active: true },
  { id: 'f-4', name: 'Net 3', type: 'NET', hourly_rate: 500, display_order: 4, is_active: true },
  { id: 'f-5', name: 'Net 4', type: 'NET', hourly_rate: 500, display_order: 5, is_active: true },
  { id: 'f-6', name: 'Net 5', type: 'NET', hourly_rate: 500, display_order: 6, is_active: true },
  { id: 'f-7', name: 'Turf Net 1', type: 'TURF_NET', hourly_rate: 700, display_order: 7, is_active: true },
  { id: 'f-8', name: 'Turf Net 2', type: 'TURF_NET', hourly_rate: 800, display_order: 8, is_active: true },
];

const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 'c-1', name: 'Rahul Verma', phone: '9876543210', team_name: 'Strikers CC', notes: 'Weekend opener', is_blacklisted: false },
  { id: 'c-2', name: 'Vikram Singh', phone: '9845123456', team_name: 'Super Kings', notes: 'Evening floodlights team', is_blacklisted: false },
  { id: 'c-3', name: 'Rohit Sharma', phone: '9711223344', team_name: 'Mumbai Smashers', notes: 'Under-19 coach batch', is_blacklisted: false },
  { id: 'c-4', name: 'Amit Patel', phone: '9822334455', team_name: 'Apex Academy', notes: 'Regular net session', is_blacklisted: false },
  { id: 'c-5', name: 'Dinesh Karthik', phone: '9988776655', team_name: 'Tamil Titans', notes: 'Fast bowler practice', is_blacklisted: false },
];

function getTodayIso(hour: number, minute: number = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const TODAY_DATE_STR = format(new Date(), 'yyyy-MM-dd');

function getInitialBookings(): Booking[] {
  return [
    {
      id: 'b-1',
      facility_id: 'f-1',
      customer_id: 'c-1',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(6, 0),
      end_time: getTodayIso(10, 0),
      team_a_name: 'Strikers CC',
      team_b_name: 'Super Kings',
      contact_person: 'Rahul Verma',
      customer_phone: '9876543210',
      booking_source: 'BROKER',
      broker_id: 'br-1',
      base_amount: 6000,
      discount_type: 'NONE',
      discount_value: 0,
      discount_amount: 0,
      total_amount: 6000,
      custom_pending_amount: null,
      pending_adjustment_reason: null,
      notes: 'Morning 20-over league match',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'b-2',
      facility_id: 'f-1',
      customer_id: 'c-2',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(16, 0),
      end_time: getTodayIso(20, 0),
      team_a_name: 'Super Kings',
      team_b_name: 'Mumbai Smashers',
      contact_person: 'Vikram Singh',
      customer_phone: '9845123456',
      booking_source: 'BROKER',
      broker_id: 'br-2',
      base_amount: 6000,
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      discount_reason: 'BROKER_OFFER',
      discount_amount: 600,
      total_amount: 5400,
      custom_pending_amount: 3400,
      pending_adjustment_reason: 'Discounted rate applied',
      notes: 'Evening floodlight match',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'b-3',
      facility_id: 'f-2',
      customer_id: 'c-3',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(6, 30),
      end_time: getTodayIso(8, 0),
      team_a_name: 'Mumbai Smashers',
      team_b_name: null,
      contact_person: 'Rohit Sharma',
      customer_phone: '9711223344',
      booking_source: 'DIRECT',
      broker_id: null,
      base_amount: 750,
      discount_type: 'NONE',
      discount_value: 0,
      discount_amount: 0,
      total_amount: 750,
      custom_pending_amount: 0,
      pending_adjustment_reason: null,
      notes: 'Batting net practice',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'b-4',
      facility_id: 'f-2',
      customer_id: 'c-4',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(18, 0),
      end_time: getTodayIso(19, 30),
      team_a_name: 'Apex Academy',
      team_b_name: null,
      contact_person: 'Amit Patel',
      customer_phone: '9822334455',
      booking_source: 'BROKER',
      broker_id: 'br-1',
      base_amount: 750,
      discount_type: 'FIXED',
      discount_value: 100,
      discount_reason: 'REGULAR_CUSTOMER',
      discount_amount: 100,
      total_amount: 650,
      custom_pending_amount: 350,
      pending_adjustment_reason: null,
      notes: 'Bowling drills',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'b-5',
      facility_id: 'f-7',
      customer_id: 'c-5',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(7, 0),
      end_time: getTodayIso(9, 0),
      team_a_name: 'Tamil Titans',
      team_b_name: null,
      contact_person: 'Dinesh Karthik',
      customer_phone: '9988776655',
      booking_source: 'DIRECT',
      broker_id: null,
      base_amount: 1400,
      discount_type: 'NONE',
      discount_value: 0,
      discount_amount: 0,
      total_amount: 1400,
      custom_pending_amount: 0,
      pending_adjustment_reason: null,
      notes: 'Turf net spin session',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'b-6',
      facility_id: 'f-8',
      customer_id: 'c-2',
      booking_date: TODAY_DATE_STR,
      start_time: getTodayIso(18, 0),
      end_time: getTodayIso(19, 30),
      team_a_name: 'Super Kings',
      team_b_name: null,
      contact_person: 'Vikram Singh',
      customer_phone: '9845123456',
      booking_source: 'BROKER',
      broker_id: 'br-3',
      base_amount: 1200,
      discount_type: 'NONE',
      discount_value: 0,
      discount_amount: 0,
      total_amount: 1200,
      custom_pending_amount: 1200,
      pending_adjustment_reason: 'Zero advance paid',
      notes: 'Warm-up net session',
      is_cancelled: false,
      created_at: new Date().toISOString(),
    },
  ];
}

function getInitialPayments(): Payment[] {
  return [
    { id: 'p-1', booking_id: 'b-1', amount: 6000, payment_method: 'UPI', transaction_reference: 'UPI/628192839120', payment_notes: 'Full GPay advance', notes: 'Full GPay advance', created_at: new Date().toISOString() },
    { id: 'p-2', booking_id: 'b-2', amount: 2000, payment_method: 'UPI', transaction_reference: 'UPI/729103948172', payment_notes: 'Advance deposit via PhonePe', notes: 'Advance deposit via PhonePe', created_at: new Date().toISOString() },
    { id: 'p-3', booking_id: 'b-3', amount: 750, payment_method: 'CASH', transaction_reference: null, payment_notes: 'Paid in cash at gate to manager', notes: 'Paid in cash at gate to manager', created_at: new Date().toISOString() },
    { id: 'p-4', booking_id: 'b-4', amount: 300, payment_method: 'UPI', transaction_reference: 'UPI/819203918273', payment_notes: 'Partial advance via Paytm', notes: 'Partial advance via Paytm', created_at: new Date().toISOString() },
    { id: 'p-5', booking_id: 'b-5', amount: 1400, payment_method: 'CARD', transaction_reference: 'POS-AUTH-9281', payment_notes: 'Full settlement via POS card swipe', notes: 'Full settlement via POS card swipe', created_at: new Date().toISOString() },
  ];
}

function getInitialAuditLogs(): BookingAuditLog[] {
  return [
    {
      id: 'log-1',
      booking_id: 'b-1',
      action_type: 'BOOKING_CREATED',
      new_value: { total_amount: 6000, facility: 'Main Ground', duration: '4 hrs' },
      performed_by: 'Ground Admin',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'log-2',
      booking_id: 'b-1',
      action_type: 'PAYMENT_COLLECTED',
      new_value: { amount: 6000, method: 'UPI', reference: 'UPI/628192839120' },
      performed_by: 'Ground Admin',
      created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    },
  ];
}

let memoryStore: Record<string, string> = {};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }
    const raw = memoryStore[key];
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
    memoryStore[key] = JSON.stringify(data);
  } catch (e) {
    console.error('Failed to save to storage', e);
  }
}

export function initializeStorage(reset: boolean = false, seedDemoData: boolean = true) {
  if (reset) {
    memoryStore = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch {}
    }
  }

  if (!loadLocal(STORAGE_KEY_FACILITIES, null)) {
    saveLocal(STORAGE_KEY_FACILITIES, DEFAULT_FACILITIES);
  }
  if (!loadLocal(STORAGE_KEY_CUSTOMERS, null)) {
    saveLocal(STORAGE_KEY_CUSTOMERS, DEFAULT_CUSTOMERS);
  }
  if (!loadLocal(STORAGE_KEY_BROKERS, null)) {
    saveLocal(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);
  }

  if (seedDemoData) {
    if (!loadLocal(STORAGE_KEY_BOOKINGS, null)) {
      saveLocal(STORAGE_KEY_BOOKINGS, getInitialBookings());
    }
    if (!loadLocal(STORAGE_KEY_PAYMENTS, null)) {
      saveLocal(STORAGE_KEY_PAYMENTS, getInitialPayments());
    }
    if (!loadLocal(STORAGE_KEY_AUDIT_LOGS, null)) {
      saveLocal(STORAGE_KEY_AUDIT_LOGS, getInitialAuditLogs());
    }
    if (!loadLocal(STORAGE_KEY_RECURRING_GROUPS, null)) {
      saveLocal(STORAGE_KEY_RECURRING_GROUPS, []);
    }
    if (!loadLocal(STORAGE_KEY_RECONCILIATIONS, null)) {
      saveLocal(STORAGE_KEY_RECONCILIATIONS, []);
    }
  } else {
    saveLocal(STORAGE_KEY_BOOKINGS, []);
    saveLocal(STORAGE_KEY_PAYMENTS, []);
    saveLocal(STORAGE_KEY_AUDIT_LOGS, []);
    saveLocal(STORAGE_KEY_RECURRING_GROUPS, []);
    saveLocal(STORAGE_KEY_RECONCILIATIONS, []);
    saveLocal(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);
  }
}

// --- AUDIT LOGGING ---

export async function recordAuditLog(
  bookingId: string,
  actionType: AuditLogAction,
  oldValue?: Record<string, any> | null,
  newValue?: Record<string, any> | null,
  performedBy: string = 'Ground Admin'
): Promise<BookingAuditLog> {
  const auditEntry: BookingAuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    booking_id: bookingId,
    action_type: actionType,
    old_value: oldValue || null,
    new_value: newValue || null,
    performed_by: performedBy,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('booking_audit_logs')
        .insert({
          booking_id: bookingId,
          action_type: actionType,
          old_value: oldValue || null,
          new_value: newValue || null,
          performed_by: performedBy,
        })
        .select()
        .single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase audit log insert fallback to local', e);
    }
  }

  initializeStorage();
  const logs = loadLocal<BookingAuditLog[]>(STORAGE_KEY_AUDIT_LOGS, getInitialAuditLogs());
  logs.unshift(auditEntry);
  saveLocal(STORAGE_KEY_AUDIT_LOGS, logs);
  return auditEntry;
}

export async function fetchBookingAuditLogs(bookingId: string): Promise<BookingAuditLog[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('booking_audit_logs')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    if (!error && data) return data;
  }

  initializeStorage();
  const logs = loadLocal<BookingAuditLog[]>(STORAGE_KEY_AUDIT_LOGS, getInitialAuditLogs());
  return logs
    .filter(l => l.booking_id === bookingId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// --- FACILITIES ---

export async function fetchFacilities(): Promise<Facility[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data) return data;
  }
  initializeStorage();
  const list = loadLocal<Facility[]>(STORAGE_KEY_FACILITIES, DEFAULT_FACILITIES);
  return list.filter(f => f.is_active).sort((a, b) => a.display_order - b.display_order);
}

export async function saveFacility(facility: Partial<Facility> & { name: string; type: Facility['type']; hourly_rate: number }): Promise<Facility> {
  if (isSupabaseConfigured && supabase) {
    if (facility.id) {
      const { data } = await supabase.from('facilities').update(facility).eq('id', facility.id).select().single();
      if (data) return data;
    } else {
      const { data } = await supabase.from('facilities').insert(facility).select().single();
      if (data) return data;
    }
  }

  initializeStorage();
  const list = loadLocal<Facility[]>(STORAGE_KEY_FACILITIES, DEFAULT_FACILITIES);
  if (facility.id) {
    const idx = list.findIndex(f => f.id === facility.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...facility };
      saveLocal(STORAGE_KEY_FACILITIES, list);
      return list[idx];
    }
  }
  const newFac: Facility = {
    id: `f-${Date.now()}`,
    name: facility.name,
    type: facility.type,
    hourly_rate: Number(facility.hourly_rate),
    display_order: list.length + 1,
    is_active: true,
  };
  list.push(newFac);
  saveLocal(STORAGE_KEY_FACILITIES, list);
  return newFac;
}

export async function deleteFacility(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.from('facilities').delete().eq('id', id);
  }
  initializeStorage();
  const list = loadLocal<Facility[]>(STORAGE_KEY_FACILITIES, DEFAULT_FACILITIES);
  saveLocal(STORAGE_KEY_FACILITIES, list.filter(f => f.id !== id));
}

// --- CUSTOMERS & BLACKLIST (PRIORITY 3) ---

export async function fetchCustomers(searchQuery?: string): Promise<Customer[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('customers').select('*');
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,team_name.ilike.%${searchQuery}%`);
    }
    const { data } = await query;
    if (data) return data;
  }

  initializeStorage();
  const list = loadLocal<Customer[]>(STORAGE_KEY_CUSTOMERS, DEFAULT_CUSTOMERS);
  if (!searchQuery) return list;
  const q = searchQuery.toLowerCase().trim();
  const cleanPhone = searchQuery.replace(/\D/g, '');

  return list.filter(c => {
    const cPhoneClean = c.phone.replace(/\D/g, '');
    const phoneMatches = cleanPhone && (cPhoneClean.includes(cleanPhone) || cleanPhone.includes(cPhoneClean));
    const nameMatches = c.name.toLowerCase().includes(q);
    const teamMatches = c.team_name && c.team_name.toLowerCase().includes(q);
    return phoneMatches || nameMatches || teamMatches;
  });
}

export async function findCustomerByPhone(phoneQuery: string): Promise<Customer | null> {
  const clean = phoneQuery.replace(/\D/g, '');
  if (clean.length < 3) return null;
  const all = await fetchCustomers();
  return all.find(c => {
    const cClean = c.phone.replace(/\D/g, '');
    return cClean.includes(clean) || clean.includes(cClean);
  }) || null;
}

export async function getOrCreateCustomer(name: string, phone: string, team_name?: string): Promise<Customer> {
  const clean = phone.replace(/\D/g, '');
  if (isSupabaseConfigured && supabase) {
    const { data: existing } = await supabase.from('customers').select('*').eq('phone', clean).maybeSingle();
    if (existing) {
      if ((name && existing.name !== name) || (team_name && existing.team_name !== team_name)) {
        const { data: updated } = await supabase.from('customers').update({ name, team_name }).eq('id', existing.id).select().single();
        if (updated) return updated;
      }
      return existing;
    }
    const { data: created } = await supabase.from('customers').insert({ name, phone: clean, team_name, is_blacklisted: false }).select().single();
    if (created) return created;
  }

  initializeStorage();
  const list = loadLocal<Customer[]>(STORAGE_KEY_CUSTOMERS, DEFAULT_CUSTOMERS);
  const existing = list.find(c => c.phone.replace(/\D/g, '') === clean);
  if (existing) {
    if (name) existing.name = name;
    if (team_name) existing.team_name = team_name;
    saveLocal(STORAGE_KEY_CUSTOMERS, list);
    return existing;
  }
  const newCust: Customer = {
    id: `c-${Date.now()}`,
    name,
    phone: clean,
    team_name: team_name || null,
    is_blacklisted: false,
    created_at: new Date().toISOString(),
  };
  list.unshift(newCust);
  saveLocal(STORAGE_KEY_CUSTOMERS, list);
  return newCust;
}

export async function toggleCustomerBlacklist(
  customerId: string,
  isBlacklisted: boolean,
  reason?: string
): Promise<Customer> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('customers')
      .update({
        is_blacklisted: isBlacklisted,
        blacklist_reason: isBlacklisted ? (reason || 'Flagged by ground manager') : null,
      })
      .eq('id', customerId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  initializeStorage();
  const list = loadLocal<Customer[]>(STORAGE_KEY_CUSTOMERS, DEFAULT_CUSTOMERS);
  const idx = list.findIndex(c => c.id === customerId);
  if (idx === -1) throw new Error('Customer not found');

  list[idx] = {
    ...list[idx],
    is_blacklisted: isBlacklisted,
    blacklist_reason: isBlacklisted ? (reason || 'Flagged by ground manager') : null,
  };
  saveLocal(STORAGE_KEY_CUSTOMERS, list);
  return list[idx];
}

export async function fetchCustomerById(customerId: string): Promise<CustomerSummary | null> {
  const allSummaries = await fetchCustomerSummaries();
  return allSummaries.find(c => c.id === customerId) || null;
}

// --- BOOKINGS & RECURRING ACADEMY ENGINE (PRIORITY 1) ---

export const WEEKDAY_MAP: Record<Weekday, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Generates array of date strings (YYYY-MM-DD) based on recurrence pattern
 */
export function generateRecurringDates(
  startDate: string,
  endDate: string,
  repeatType: RepeatType,
  weekdays?: Weekday[]
): string[] {
  if (repeatType === 'NONE' || !endDate || endDate < startDate) {
    return [startDate];
  }

  const start = parseISO(`${startDate}T00:00:00`);
  const end = parseISO(`${endDate}T00:00:00`);
  const allDates = eachDayOfInterval({ start, end });

  if (repeatType === 'DAILY') {
    return allDates.map(d => format(d, 'yyyy-MM-dd'));
  }

  if (repeatType === 'WEEKLY') {
    const startDayOfWeek = getDay(start);
    return allDates
      .filter(d => getDay(d) === startDayOfWeek)
      .map(d => format(d, 'yyyy-MM-dd'));
  }

  if (repeatType === 'CUSTOM_WEEKDAYS') {
    if (!weekdays || weekdays.length === 0) {
      return [startDate];
    }
    const targetDays = new Set(weekdays.map(w => WEEKDAY_MAP[w]));
    return allDates
      .filter(d => targetDays.has(getDay(d)))
      .map(d => format(d, 'yyyy-MM-dd'));
  }

  return [startDate];
}

/**
 * Scans all generated recurring dates against existing bookings for conflicts
 */
export async function analyzeRecurrenceConflicts(
  facilityId: string,
  dates: string[],
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<RecurrenceConflictResult> {
  const allBookings = await fetchBookings();
  const availableDates: string[] = [];
  const conflicts: RecurrenceConflictItem[] = [];

  for (const dateStr of dates) {
    const conflictResult = hasBookingConflict(
      facilityId,
      dateStr,
      startTime,
      endTime,
      excludeBookingId,
      allBookings
    );

    if (conflictResult.hasConflict && conflictResult.conflictingBooking) {
      conflicts.push({
        date: dateStr,
        startTime,
        endTime,
        conflictingBooking: conflictResult.conflictingBooking,
      });
    } else {
      availableDates.push(dateStr);
    }
  }

  return {
    totalRequested: dates.length,
    availableDates,
    conflicts,
  };
}

export function computeBookingFinancials(
  booking: Booking,
  payments: Payment[]
): { total_paid: number; pending_amount: number; payment_status: PaymentStatus } {
  const bPayments = payments.filter(p => p.booking_id === booking.id);
  const total_paid = bPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalAmount = Number(booking.total_amount);

  let pending_amount: number;
  if (booking.custom_pending_amount !== undefined && booking.custom_pending_amount !== null) {
    pending_amount = Math.max(0, Number(booking.custom_pending_amount));
  } else {
    pending_amount = Math.max(0, totalAmount - total_paid);
  }

  let payment_status: PaymentStatus = 'UNPAID';
  if (pending_amount === 0 && (total_paid > 0 || totalAmount === 0)) {
    payment_status = 'FULLY_PAID';
  } else if (total_paid > 0) {
    payment_status = 'PARTIALLY_PAID';
  }

  return { total_paid, pending_amount, payment_status };
}

export async function fetchBookings(dateFilter?: string): Promise<Booking[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('bookings').select(`
      *,
      facility:facilities(*),
      customer:customers(*),
      payments(*),
      audit_logs:booking_audit_logs(*),
      recurring_group:recurring_booking_groups(*)
    `).eq('is_cancelled', false);

    if (dateFilter) {
      query = query.eq('booking_date', dateFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      return data.map(b => {
        const financials = computeBookingFinancials(b, b.payments || []);
        return {
          ...b,
          booking_date: b.booking_date || format(parseISO(b.start_time), 'yyyy-MM-dd'),
          ...financials,
        };
      });
    }
  }

  initializeStorage();
  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const facilities = loadLocal<Facility[]>(STORAGE_KEY_FACILITIES, DEFAULT_FACILITIES);
  const customers = loadLocal<Customer[]>(STORAGE_KEY_CUSTOMERS, DEFAULT_CUSTOMERS);
  const payments = loadLocal<Payment[]>(STORAGE_KEY_PAYMENTS, getInitialPayments());
  const auditLogs = loadLocal<BookingAuditLog[]>(STORAGE_KEY_AUDIT_LOGS, getInitialAuditLogs());
  const recurringGroups = loadLocal<RecurringBookingGroup[]>(STORAGE_KEY_RECURRING_GROUPS, []);
  const brokers = loadLocal<Broker[]>(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);

  const facilityMap = new Map(facilities.map(f => [f.id, f]));
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const groupMap = new Map(recurringGroups.map(g => [g.id, g]));
  const brokerMap = new Map(brokers.map(br => [br.id, br]));

  return bookings
    .filter(b => !b.is_cancelled)
    .filter(b => {
      if (!dateFilter) return true;
      const bDate = b.booking_date || format(parseISO(b.start_time), 'yyyy-MM-dd');
      return bDate === dateFilter;
    })
    .map(b => {
      const bPayments = payments.filter(p => p.booking_id === b.id);
      const bLogs = auditLogs.filter(l => l.booking_id === b.id).sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
      const financials = computeBookingFinancials(b, payments);
      return {
        ...b,
        booking_date: b.booking_date || format(parseISO(b.start_time), 'yyyy-MM-dd'),
        facility: facilityMap.get(b.facility_id),
        customer: customerMap.get(b.customer_id),
        broker: b.broker_id ? brokerMap.get(b.broker_id) : undefined,
        payments: bPayments,
        audit_logs: bLogs,
        recurring_group: b.recurring_group_id ? groupMap.get(b.recurring_group_id) : undefined,
        ...financials,
      };
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export function hasBookingConflict(
  facilityId: string,
  bookingDate: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
  bookingsList?: Booking[]
): { hasConflict: boolean; conflictingBooking?: Booking } {
  const { startIso, endIso } = createSafeBookingInterval(bookingDate, startTime, endTime);
  const start = parseISO(startIso);
  const end = parseISO(endIso);

  const bookingsToScan = bookingsList || [];

  const conflict = bookingsToScan.find((b) => {
    if (b.facility_id !== facilityId) return false;
    if (b.is_cancelled) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;

    const bStart = parseISO(b.start_time);
    const bEnd = parseISO(b.end_time);

    return areIntervalsOverlapping(
      { start, end },
      { start: bStart, end: bEnd },
      { inclusive: false }
    );
  });

  return {
    hasConflict: Boolean(conflict),
    conflictingBooking: conflict,
  };
}

export async function checkBookingConflict(
  facilityId: string,
  startIso: string,
  endIso: string,
  excludeBookingId?: string
): Promise<{ hasConflict: boolean; conflictingBooking?: Booking }> {
  const allBookings = await fetchBookings();
  const start = parseISO(startIso);
  const end = parseISO(endIso);

  const conflict = allBookings.find(b => {
    if (b.facility_id !== facilityId) return false;
    if (b.is_cancelled) return false;
    if (excludeBookingId && b.id === excludeBookingId) return false;

    const bStart = parseISO(b.start_time);
    const bEnd = parseISO(b.end_time);

    return areIntervalsOverlapping(
      { start, end },
      { start: bStart, end: bEnd },
      { inclusive: false }
    );
  });

  return {
    hasConflict: Boolean(conflict),
    conflictingBooking: conflict,
  };
}

export async function createQuickBooking(formData: QuickBookFormData): Promise<Booking> {
  // 1. Blacklist check
  const customer = await getOrCreateCustomer(
    formData.customer_name,
    formData.customer_phone,
    formData.team_name
  );

  if (customer.is_blacklisted && !formData.allow_blacklist_override) {
    throw new Error(`Customer is blacklisted: ${customer.blacklist_reason || 'Unauthorized'}. Manager override required.`);
  }

  // If recurring repeat is selected with multiple dates
  if (formData.repeat_type && formData.repeat_type !== 'NONE' && formData.repeat_end_date) {
    const dates = generateRecurringDates(
      formData.date,
      formData.repeat_end_date,
      formData.repeat_type,
      formData.repeat_weekdays
    );

    if (dates.length > 1) {
      const result = await createRecurringBookings(formData, dates);
      return result.bookings[0];
    }
  }

  // Single booking creation
  const { startIso, endIso } = createSafeBookingInterval(formData.date, formData.start_time, formData.end_time);

  if (!formData.is_conflict_override) {
    const conflict = await checkBookingConflict(formData.facility_id, startIso, endIso);
    if (conflict.hasConflict) {
      throw new Error('Facility already booked during this time.');
    }
  }

  const customPending = formData.custom_pending_amount !== undefined ? formData.custom_pending_amount : null;
  const adjustmentReason = formData.pending_adjustment_reason || null;
  const bookingDate = formData.date;

  const teamAName = formData.team_a_name || formData.team_name || formData.customer_name;
  const teamBName = formData.team_b_name || null;
  const contactPerson = formData.customer_name;
  const customerPhone = formData.customer_phone;
  const bookingSource: BookingSource = formData.booking_source || (formData.broker_id ? 'BROKER' : 'DIRECT');
  const brokerId = formData.broker_id || null;
  const discountType: DiscountType = formData.discount_type || 'NONE';
  const discountValue = Number(formData.discount_value) || 0;
  const discountReason = formData.discount_reason || null;

  let baseAmount = Number(formData.total_amount);
  let discountAmount = 0;
  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    baseAmount = Math.round(Number(formData.total_amount) / (1 - discountValue / 100));
    discountAmount = baseAmount - Number(formData.total_amount);
  } else if (discountType === 'FIXED' && discountValue > 0) {
    discountAmount = discountValue;
    baseAmount = Number(formData.total_amount) + discountAmount;
  }

  if (isSupabaseConfigured && supabase) {
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        facility_id: formData.facility_id,
        customer_id: customer.id,
        booking_date: bookingDate,
        start_time: startIso,
        end_time: endIso,
        total_amount: Number(formData.total_amount),
        custom_pending_amount: customPending,
        pending_adjustment_reason: adjustmentReason,
        allow_due_override: Boolean(formData.allow_due_override),
        is_conflict_override: Boolean(formData.is_conflict_override),
        notes: formData.notes,
      })
      .select(`*, facility:facilities(*), customer:customers(*)`)
      .single();

    if (error) {
      if ((error.message.includes('prevent_facility_double_booking') || error.code === '23P01') && !formData.is_conflict_override) {
        throw new Error('Facility already booked during this time.');
      }
      throw new Error(error.message);
    }

    await recordAuditLog(
      booking.id,
      'BOOKING_CREATED',
      null,
      {
        total_amount: Number(formData.total_amount),
        start_time: startIso,
        end_time: endIso,
        facility_id: formData.facility_id,
        customer_name: formData.customer_name,
        advance_paid: formData.advance_paid,
      }
    );

    if (formData.is_conflict_override) {
      await recordAuditLog(
        booking.id,
        'CONFLICT_OVERRIDE',
        null,
        { reason: 'Manager forced booking override over existing schedule' }
      );
    }

    if (formData.advance_paid > 0) {
      await supabase.from('payments').insert({
        booking_id: booking.id,
        amount: Number(formData.advance_paid),
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference || null,
        payment_notes: 'Advance booking deposit',
        notes: 'Advance booking deposit',
      });

      await recordAuditLog(
        booking.id,
        'PAYMENT_COLLECTED',
        null,
        {
          amount: Number(formData.advance_paid),
          payment_method: formData.payment_method,
          transaction_reference: formData.transaction_reference || 'N/A',
          type: 'Advance deposit',
        }
      );
    }

    const refreshed = await fetchBookings();
    return refreshed.find(b => b.id === booking.id)!;
  }

  // Storage fallback
  initializeStorage();
  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const newBookingId = `b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newBooking: Booking = {
    id: newBookingId,
    facility_id: formData.facility_id,
    customer_id: customer.id,
    booking_date: bookingDate,
    start_time: startIso,
    end_time: endIso,
    team_a_name: teamAName,
    team_b_name: teamBName,
    contact_person: contactPerson,
    customer_phone: customerPhone,
    booking_source: bookingSource,
    broker_id: brokerId,
    base_amount: baseAmount,
    discount_type: discountType,
    discount_value: discountValue,
    discount_reason: discountReason,
    discount_amount: discountAmount,
    total_amount: Number(formData.total_amount),
    custom_pending_amount: customPending,
    pending_adjustment_reason: adjustmentReason,
    allow_due_override: Boolean(formData.allow_due_override),
    is_conflict_override: Boolean(formData.is_conflict_override),
    notes: formData.notes || null,
    is_cancelled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  bookings.push(newBooking);
  saveLocal(STORAGE_KEY_BOOKINGS, bookings);

  await recordAuditLog(
    newBookingId,
    'BOOKING_CREATED',
    null,
    {
      total_amount: Number(formData.total_amount),
      start_time: startIso,
      end_time: endIso,
      facility_id: formData.facility_id,
      customer_name: formData.customer_name,
      advance_paid: formData.advance_paid,
    }
  );

  if (formData.is_conflict_override) {
    await recordAuditLog(
      newBookingId,
      'CONFLICT_OVERRIDE',
      null,
      { reason: 'Manager forced booking override over existing schedule' }
    );
  }

  if (Number(formData.advance_paid) > 0) {
    const payments = loadLocal<Payment[]>(STORAGE_KEY_PAYMENTS, getInitialPayments());
    payments.push({
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      booking_id: newBookingId,
      amount: Number(formData.advance_paid),
      payment_method: formData.payment_method,
      transaction_reference: formData.transaction_reference || null,
      payment_notes: 'Advance booking deposit',
      notes: 'Advance booking deposit',
      created_at: new Date().toISOString(),
    });
    saveLocal(STORAGE_KEY_PAYMENTS, payments);

    await recordAuditLog(
      newBookingId,
      'PAYMENT_COLLECTED',
      null,
      {
        amount: Number(formData.advance_paid),
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference || 'N/A',
        type: 'Advance deposit',
      }
    );
  }

  const refreshed = await fetchBookings();
  return refreshed.find(b => b.id === newBookingId)!;
}

/**
 * RECURRING ACADEMY BOOKINGS BATCH CREATION
 */
export async function createRecurringBookings(
  formData: QuickBookFormData,
  allowedDates?: string[]
): Promise<{ group: RecurringBookingGroup; bookings: Booking[]; createdCount: number }> {
  const customer = await getOrCreateCustomer(
    formData.customer_name,
    formData.customer_phone,
    formData.team_name
  );

  if (customer.is_blacklisted && !formData.allow_blacklist_override) {
    throw new Error(`Customer is blacklisted: ${customer.blacklist_reason || 'Unauthorized'}. Manager override required.`);
  }

  const repeatType = formData.repeat_type || 'WEEKLY';
  const repeatEndDate = formData.repeat_end_date || formData.date;
  const weekdays = formData.repeat_weekdays || [];

  const targetDates = allowedDates || generateRecurringDates(
    formData.date,
    repeatEndDate,
    repeatType,
    weekdays
  );

  const groupId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const groupName = formData.recurring_group_name || `${formData.customer_name} Academy Series`;

  const group: RecurringBookingGroup = {
    id: groupId,
    name: groupName,
    repeat_type: repeatType,
    weekdays,
    start_date: formData.date,
    end_date: repeatEndDate,
    created_at: new Date().toISOString(),
  };

  // Supabase Group Insertion
  if (isSupabaseConfigured && supabase) {
    await supabase.from('recurring_booking_groups').insert({
      id: groupId,
      name: groupName,
      repeat_type: repeatType,
      weekdays: weekdays,
      start_date: formData.date,
      end_date: repeatEndDate,
    });
  } else {
    initializeStorage();
    const groups = loadLocal<RecurringBookingGroup[]>(STORAGE_KEY_RECURRING_GROUPS, []);
    groups.push(group);
    saveLocal(STORAGE_KEY_RECURRING_GROUPS, groups);
  }

  const createdBookings: Booking[] = [];

  for (let i = 0; i < targetDates.length; i++) {
    const dStr = targetDates[i];
    const { startIso, endIso } = createSafeBookingInterval(dStr, formData.start_time, formData.end_time);

    // Apply advance payment to the 1st booking only
    const advancePaidForThis = i === 0 ? Number(formData.advance_paid || 0) : 0;
    const customPending = i === 0 && formData.custom_pending_amount !== undefined 
      ? formData.custom_pending_amount 
      : null;

    if (isSupabaseConfigured && supabase) {
      const { data: b } = await supabase.from('bookings').insert({
        facility_id: formData.facility_id,
        customer_id: customer.id,
        recurring_group_id: groupId,
        booking_date: dStr,
        start_time: startIso,
        end_time: endIso,
        total_amount: Number(formData.total_amount),
        custom_pending_amount: customPending,
        pending_adjustment_reason: formData.pending_adjustment_reason || null,
        allow_due_override: Boolean(formData.allow_due_override),
        is_conflict_override: Boolean(formData.is_conflict_override),
        notes: formData.notes ? `${formData.notes} (Series ${i + 1}/${targetDates.length})` : `Series ${i + 1}/${targetDates.length}`,
      }).select().single();

      if (b) {
        if (advancePaidForThis > 0) {
          await supabase.from('payments').insert({
            booking_id: b.id,
            amount: advancePaidForThis,
            payment_method: formData.payment_method,
            transaction_reference: formData.transaction_reference || null,
            payment_notes: 'Advance deposit for series',
            notes: 'Advance deposit for series',
          });
        }
        await recordAuditLog(b.id, 'BOOKING_CREATED', null, { series_index: i + 1, total_series: targetDates.length });
        createdBookings.push(b);
      }
    } else {
      initializeStorage();
      const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
      const bId = `b-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`;

      const newB: Booking = {
        id: bId,
        facility_id: formData.facility_id,
        customer_id: customer.id,
        recurring_group_id: groupId,
        booking_date: dStr,
        start_time: startIso,
        end_time: endIso,
        team_a_name: formData.team_a_name || formData.team_name || formData.customer_name,
        team_b_name: formData.team_b_name || null,
        contact_person: formData.customer_name,
        customer_phone: formData.customer_phone,
        booking_source: formData.booking_source || (formData.broker_id ? 'BROKER' : 'DIRECT'),
        broker_id: formData.broker_id || null,
        base_amount: Number(formData.total_amount),
        discount_type: formData.discount_type || 'NONE',
        discount_value: Number(formData.discount_value) || 0,
        discount_reason: formData.discount_reason || null,
        discount_amount: 0,
        total_amount: Number(formData.total_amount),
        custom_pending_amount: customPending,
        pending_adjustment_reason: formData.pending_adjustment_reason || null,
        allow_due_override: Boolean(formData.allow_due_override),
        is_conflict_override: Boolean(formData.is_conflict_override),
        notes: formData.notes ? `${formData.notes} (Series ${i + 1}/${targetDates.length})` : `Series ${i + 1}/${targetDates.length}`,
        is_cancelled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      bookings.push(newB);
      saveLocal(STORAGE_KEY_BOOKINGS, bookings);

      if (advancePaidForThis > 0) {
        const payments = loadLocal<Payment[]>(STORAGE_KEY_PAYMENTS, getInitialPayments());
        payments.push({
          id: `p-${Date.now()}`,
          booking_id: bId,
          amount: advancePaidForThis,
          payment_method: formData.payment_method,
          transaction_reference: formData.transaction_reference || null,
          payment_notes: 'Advance deposit for series',
          notes: 'Advance deposit for series',
          created_at: new Date().toISOString(),
        });
        saveLocal(STORAGE_KEY_PAYMENTS, payments);
      }

      await recordAuditLog(bId, 'BOOKING_CREATED', null, { series_index: i + 1, total_series: targetDates.length });
      createdBookings.push(newB);
    }
  }

  return {
    group,
    bookings: createdBookings,
    createdCount: createdBookings.length,
  };
}

/**
 * EDIT / RESCHEDULE BOOKING OR ENTIRE SERIES
 */
export async function updateBooking(formData: EditBookingFormData): Promise<Booking> {
  const { startIso, endIso } = createSafeBookingInterval(formData.date, formData.start_time, formData.end_time);

  if (!formData.is_conflict_override) {
    const conflict = await checkBookingConflict(formData.facility_id, startIso, endIso, formData.booking_id);
    if (conflict.hasConflict) {
      throw new Error('Facility already booked during this time.');
    }
  }

  const customer = await getOrCreateCustomer(
    formData.customer_name,
    formData.customer_phone,
    formData.team_name
  );

  const customPending = formData.custom_pending_amount !== undefined ? formData.custom_pending_amount : null;
  const adjustmentReason = formData.pending_adjustment_reason || null;
  const updatedAt = new Date().toISOString();
  const bookingDate = formData.date;

  const allCurrent = await fetchBookings();
  const prevBooking = allCurrent.find(b => b.id === formData.booking_id);
  const isRescheduled = prevBooking && (prevBooking.start_time !== startIso || prevBooking.end_time !== endIso);
  const actionType: AuditLogAction = isRescheduled ? 'BOOKING_RESCHEDULED' : 'BOOKING_EDITED';

  const teamAName = formData.team_a_name || formData.team_name || formData.customer_name;
  const teamBName = formData.team_b_name !== undefined ? (formData.team_b_name || null) : (prevBooking?.team_b_name || null);
  const contactPerson = formData.customer_name;
  const customerPhone = formData.customer_phone;
  const bookingSource = formData.booking_source || prevBooking?.booking_source || (formData.broker_id ? 'BROKER' : 'DIRECT');
  const brokerId = formData.broker_id !== undefined ? (formData.broker_id || null) : (prevBooking?.broker_id || null);
  const discountType = formData.discount_type || prevBooking?.discount_type || 'NONE';
  const discountValue = formData.discount_value !== undefined ? Number(formData.discount_value) : (prevBooking?.discount_value || 0);
  const discountReason = formData.discount_reason !== undefined ? formData.discount_reason : (prevBooking?.discount_reason || null);

  let baseAmount = Number(formData.total_amount);
  let discountAmount = 0;
  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    baseAmount = Math.round(Number(formData.total_amount) / (1 - discountValue / 100));
    discountAmount = baseAmount - Number(formData.total_amount);
  } else if (discountType === 'FIXED' && discountValue > 0) {
    discountAmount = discountValue;
    baseAmount = Number(formData.total_amount) + discountAmount;
  }

  // If editing future series
  if (formData.edit_series_mode === 'FUTURE_SERIES' && prevBooking?.recurring_group_id) {
    const groupBookings = allCurrent.filter(b => 
      b.recurring_group_id === prevBooking.recurring_group_id && 
      !b.is_cancelled && 
      b.booking_date >= prevBooking.booking_date
    );

    for (const b of groupBookings) {
      const { startIso: fStart, endIso: fEnd } = createSafeBookingInterval(b.booking_date, formData.start_time, formData.end_time);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('bookings').update({
          facility_id: formData.facility_id,
          customer_id: customer.id,
          start_time: fStart,
          end_time: fEnd,
          total_amount: Number(formData.total_amount),
          notes: formData.notes || b.notes,
          updated_at: updatedAt,
        }).eq('id', b.id);
      } else {
        initializeStorage();
        const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
        const bIdx = bookings.findIndex(x => x.id === b.id);
        if (bIdx !== -1) {
          bookings[bIdx] = {
            ...bookings[bIdx],
            facility_id: formData.facility_id,
            customer_id: customer.id,
            start_time: fStart,
            end_time: fEnd,
            team_a_name: teamAName,
            team_b_name: teamBName,
            contact_person: contactPerson,
            customer_phone: customerPhone,
            booking_source: bookingSource,
            broker_id: brokerId,
            base_amount: baseAmount,
            discount_type: discountType,
            discount_value: discountValue,
            discount_reason: discountReason,
            discount_amount: discountAmount,
            total_amount: Number(formData.total_amount),
            notes: formData.notes || bookings[bIdx].notes,
            updated_at: updatedAt,
          };
          saveLocal(STORAGE_KEY_BOOKINGS, bookings);
        }
      }
      await recordAuditLog(b.id, actionType, null, { series_update: true, start_time: fStart, end_time: fEnd });
    }

    const refreshed = await fetchBookings();
    return refreshed.find(b => b.id === formData.booking_id)!;
  }

  // Single booking update
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('bookings')
      .update({
        facility_id: formData.facility_id,
        customer_id: customer.id,
        booking_date: bookingDate,
        start_time: startIso,
        end_time: endIso,
        total_amount: Number(formData.total_amount),
        custom_pending_amount: customPending,
        pending_adjustment_reason: adjustmentReason,
        allow_due_override: Boolean(formData.allow_due_override),
        is_conflict_override: Boolean(formData.is_conflict_override),
        notes: formData.notes || null,
        updated_at: updatedAt,
      })
      .eq('id', formData.booking_id)
      .select(`*, facility:facilities(*), customer:customers(*)`)
      .single();

    if (error) {
      if ((error.message.includes('prevent_facility_double_booking') || error.code === '23P01') && !formData.is_conflict_override) {
        throw new Error('Facility already booked during this time.');
      }
      throw new Error(error.message);
    }

    await recordAuditLog(
      formData.booking_id,
      actionType,
      prevBooking ? {
        facility_id: prevBooking.facility_id,
        start_time: prevBooking.start_time,
        end_time: prevBooking.end_time,
        total_amount: prevBooking.total_amount,
      } : null,
      {
        facility_id: formData.facility_id,
        start_time: startIso,
        end_time: endIso,
        total_amount: formData.total_amount,
      }
    );

    const refreshed = await fetchBookings();
    return refreshed.find(b => b.id === formData.booking_id)!;
  }

  initializeStorage();
  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const idx = bookings.findIndex(b => b.id === formData.booking_id);
  if (idx === -1) throw new Error('Booking not found');

  const oldSnapshot = { ...bookings[idx] };

  bookings[idx] = {
    ...bookings[idx],
    facility_id: formData.facility_id,
    customer_id: customer.id,
    booking_date: bookingDate,
    start_time: startIso,
    end_time: endIso,
    team_a_name: teamAName,
    team_b_name: teamBName,
    contact_person: contactPerson,
    customer_phone: customerPhone,
    booking_source: bookingSource,
    broker_id: brokerId,
    base_amount: baseAmount,
    discount_type: discountType,
    discount_value: discountValue,
    discount_reason: discountReason,
    discount_amount: discountAmount,
    total_amount: Number(formData.total_amount),
    custom_pending_amount: customPending,
    pending_adjustment_reason: adjustmentReason,
    allow_due_override: Boolean(formData.allow_due_override),
    is_conflict_override: Boolean(formData.is_conflict_override),
    notes: formData.notes || null,
    updated_at: updatedAt,
  };

  saveLocal(STORAGE_KEY_BOOKINGS, bookings);

  await recordAuditLog(
    formData.booking_id,
    actionType,
    {
      facility_id: oldSnapshot.facility_id,
      start_time: oldSnapshot.start_time,
      end_time: oldSnapshot.end_time,
      total_amount: oldSnapshot.total_amount,
    },
    {
      facility_id: formData.facility_id,
      start_time: startIso,
      end_time: endIso,
      total_amount: formData.total_amount,
    }
  );

  const refreshed = await fetchBookings();
  return refreshed.find(b => b.id === formData.booking_id)!;
}

/**
 * CANCEL BOOKING OR ENTIRE RECURRING SERIES
 */
export async function cancelBookingSeries(
  bookingId: string,
  mode: 'THIS_ONLY' | 'FUTURE_SERIES' = 'THIS_ONLY'
): Promise<{ cancelledCount: number }> {
  const allCurrent = await fetchBookings();
  const target = allCurrent.find(b => b.id === bookingId);
  if (!target) return { cancelledCount: 0 };

  if (mode === 'FUTURE_SERIES' && target.recurring_group_id) {
    const toCancel = allCurrent.filter(b => 
      b.recurring_group_id === target.recurring_group_id && 
      !b.is_cancelled && 
      b.booking_date >= target.booking_date
    );

    for (const b of toCancel) {
      await cancelBooking(b.id);
    }
    return { cancelledCount: toCancel.length };
  }

  await cancelBooking(bookingId);
  return { cancelledCount: 1 };
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const allCurrent = await fetchBookings();
  const prevBooking = allCurrent.find(b => b.id === bookingId);

  if (isSupabaseConfigured && supabase) {
    await supabase.from('bookings').update({ is_cancelled: true }).eq('id', bookingId);
    await recordAuditLog(
      bookingId,
      'BOOKING_CANCELLED',
      prevBooking ? { total_amount: prevBooking.total_amount, facility_id: prevBooking.facility_id } : null,
      { is_cancelled: true, reason: 'Cancelled by admin' }
    );
    return;
  }

  initializeStorage();
  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx !== -1) {
    bookings[idx].is_cancelled = true;
    saveLocal(STORAGE_KEY_BOOKINGS, bookings);

    await recordAuditLog(
      bookingId,
      'BOOKING_CANCELLED',
      prevBooking ? { total_amount: prevBooking.total_amount, facility_id: prevBooking.facility_id } : null,
      { is_cancelled: true, reason: 'Cancelled by admin' }
    );
  }
}

export function filterBookings(
  bookings: Booking[],
  filters: BookingSearchFilters
): Booking[] {
  const q = filters.searchQuery.toLowerCase().trim();
  const cleanPhoneQ = filters.searchQuery.replace(/\D/g, '');
  const now = new Date();
  const todayStart = startOfDay(now);

  return bookings.filter((b) => {
    if (filters.facilityId && filters.facilityId !== 'ALL') {
      if (b.facility_id !== filters.facilityId) return false;
    }

    const bDate = b.booking_date || format(parseISO(b.start_time), 'yyyy-MM-dd');
    if (filters.startDate && bDate < filters.startDate) return false;
    if (filters.endDate && bDate > filters.endDate) return false;

    if (filters.statusFilter && filters.statusFilter !== 'ALL') {
      const bStartTime = parseISO(b.start_time);
      const isCancelled = Boolean(b.is_cancelled);

      switch (filters.statusFilter) {
        case 'CANCELLED':
          if (!isCancelled) return false;
          break;
        case 'TODAY':
          if (isCancelled || !isToday(bStartTime)) return false;
          break;
        case 'TOMORROW':
          if (isCancelled || !isTomorrow(bStartTime)) return false;
          break;
        case 'UPCOMING':
          if (isCancelled || isBefore(bStartTime, todayStart)) return false;
          break;
        case 'PAST':
          if (isCancelled || !isBefore(bStartTime, todayStart)) return false;
          break;
        case 'PENDING_PAYMENT':
          if (isCancelled || (b.pending_amount || 0) <= 0) return false;
          break;
        case 'PARTIALLY_PAID':
          if (isCancelled || b.payment_status !== 'PARTIALLY_PAID') return false;
          break;
        case 'FULLY_PAID':
          if (isCancelled || b.payment_status !== 'FULLY_PAID') return false;
          break;
      }
    }

    if (q.length > 0) {
      const custName = (b.customer?.name || '').toLowerCase();
      const custTeam = (b.customer?.team_name || '').toLowerCase();
      const facName = (b.facility?.name || '').toLowerCase();
      const bDateFormatted = format(parseISO(b.start_time), 'dd MMM yyyy').toLowerCase();
      const notes = (b.notes || '').toLowerCase();

      const custPhone = (b.customer?.phone || '').replace(/\D/g, '');
      const phoneMatches = cleanPhoneQ.length > 0 && custPhone.includes(cleanPhoneQ);

      const txnRefs = (b.payments || [])
        .map(p => (p.transaction_reference || '').toLowerCase())
        .join(' ');
      const refMatches = txnRefs.includes(q);

      const textMatches =
        custName.includes(q) ||
        custTeam.includes(q) ||
        facName.includes(q) ||
        bDate.includes(q) ||
        bDateFormatted.includes(q) ||
        notes.includes(q) ||
        refMatches;

      if (!phoneMatches && !textMatches) return false;
    }

    return true;
  });
}

export async function updateBookingPendingBalance(
  bookingId: string,
  newPendingAmount: number,
  reason?: string
): Promise<void> {
  const allCurrent = await fetchBookings();
  const prevBooking = allCurrent.find(b => b.id === bookingId);
  const oldDue = prevBooking?.pending_amount || 0;

  if (isSupabaseConfigured && supabase) {
    await supabase.from('bookings').update({
      custom_pending_amount: Number(newPendingAmount),
      pending_adjustment_reason: reason || null,
    }).eq('id', bookingId);

    await recordAuditLog(
      bookingId,
      'DUE_AMOUNT_CHANGED',
      { previous_due: oldDue },
      { new_due: Number(newPendingAmount), reason: reason || 'Manual adjustment' }
    );
    return;
  }

  initializeStorage();
  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx !== -1) {
    bookings[idx].custom_pending_amount = Number(newPendingAmount);
    bookings[idx].pending_adjustment_reason = reason || null;
    saveLocal(STORAGE_KEY_BOOKINGS, bookings);

    await recordAuditLog(
      bookingId,
      'DUE_AMOUNT_CHANGED',
      { previous_due: oldDue },
      { new_due: Number(newPendingAmount), reason: reason || 'Manual adjustment' }
    );
  }
}

export async function recordPayment(
  bookingId: string,
  amount: number,
  method: 'UPI' | 'CASH' | 'CARD',
  notes?: string,
  transactionReference?: string
): Promise<Payment> {
  const paymentNotes = notes || (method === 'CASH' ? 'Cash collected at desk' : 'Electronic settlement');
  const txnRef = transactionReference?.trim() || null;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: Number(amount),
        payment_method: method,
        transaction_reference: txnRef,
        payment_notes: paymentNotes,
        notes: paymentNotes,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (booking && booking.custom_pending_amount !== null) {
      const updatedDue = Math.max(0, Number(booking.custom_pending_amount) - Number(amount));
      await supabase.from('bookings').update({ custom_pending_amount: updatedDue }).eq('id', bookingId);
    }

    await recordAuditLog(
      bookingId,
      'PAYMENT_COLLECTED',
      null,
      {
        amount: Number(amount),
        payment_method: method,
        transaction_reference: txnRef || 'N/A',
        notes: paymentNotes,
      }
    );

    return data;
  }

  initializeStorage();
  const payments = loadLocal<Payment[]>(STORAGE_KEY_PAYMENTS, getInitialPayments());
  const newPayment: Payment = {
    id: `p-${Date.now()}`,
    booking_id: bookingId,
    amount: Number(amount),
    payment_method: method,
    transaction_reference: txnRef,
    payment_notes: paymentNotes,
    notes: paymentNotes,
    created_at: new Date().toISOString(),
  };
  payments.push(newPayment);
  saveLocal(STORAGE_KEY_PAYMENTS, payments);

  const bookings = loadLocal<Booking[]>(STORAGE_KEY_BOOKINGS, getInitialBookings());
  const bIdx = bookings.findIndex(b => b.id === bookingId);
  if (bIdx !== -1 && bookings[bIdx].custom_pending_amount !== undefined && bookings[bIdx].custom_pending_amount !== null) {
    bookings[bIdx].custom_pending_amount = Math.max(0, Number(bookings[bIdx].custom_pending_amount) - Number(amount));
    saveLocal(STORAGE_KEY_BOOKINGS, bookings);
  }

  await recordAuditLog(
    bookingId,
    'PAYMENT_COLLECTED',
    null,
    {
      amount: Number(amount),
      payment_method: method,
      transaction_reference: txnRef || 'N/A',
      notes: paymentNotes,
    }
  );

  return newPayment;
}

export async function fetchDueBookings(): Promise<Booking[]> {
  const all = await fetchBookings();
  return all
    .filter(b => (b.pending_amount || 0) > 0)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export async function fetchCustomerSummaries(query?: string): Promise<CustomerSummary[]> {
  const customers = await fetchCustomers(query);
  const allBookings = await fetchBookings();

  return customers.map(c => {
    const cBookings = allBookings.filter(b => b.customer_id === c.id);
    const booking_count = cBookings.length;
    const total_spent = cBookings.reduce((sum, b) => sum + (b.total_paid || 0), 0);
    const total_pending = cBookings.reduce((sum, b) => sum + (b.pending_amount || 0), 0);
    const lastBooking = cBookings[cBookings.length - 1];

    const settledCount = cBookings.filter(b => b.payment_status === 'FULLY_PAID').length;
    const reliability_score = booking_count > 0 ? Math.round((settledCount / booking_count) * 100) : 100;

    return {
      ...c,
      booking_count,
      total_spent,
      total_pending,
      last_booking_date: lastBooking ? lastBooking.start_time : undefined,
      reliability_score,
      bookings: cBookings,
    };
  }).sort((a, b) => b.total_spent - a.total_spent);
}

export async function fetchDailyStats(dateStr: string): Promise<DailyStats> {
  const bookingsToday = await fetchBookings(dateStr);
  const totalBookings = bookingsToday.length;

  let collectedToday = 0;
  let pendingToday = 0;
  let upiCollected = 0;
  let cashCollected = 0;

  bookingsToday.forEach(b => {
    collectedToday += (b.total_paid || 0);
    pendingToday += (b.pending_amount || 0);

    b.payments?.forEach(p => {
      if (p.payment_method === 'UPI') upiCollected += Number(p.amount);
      if (p.payment_method === 'CASH') cashCollected += Number(p.amount);
      if (p.payment_method === 'CARD') upiCollected += Number(p.amount);
    });
  });

  return {
    totalBookings,
    collectedToday,
    pendingToday,
    upiCollected,
    cashCollected,
  };
}

// --- END OF DAY RECONCILIATION ENGINE (PRIORITY 5) ---

export async function computeReconciliationExpected(dateStr: string): Promise<{ cash: number; upi: number; card: number; total: number }> {
  const bookingsOnDate = await fetchBookings(dateStr);
  let cash = 0;
  let upi = 0;
  let card = 0;

  bookingsOnDate.forEach(b => {
    b.payments?.forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.payment_method === 'CASH') cash += amt;
      if (p.payment_method === 'UPI') upi += amt;
      if (p.payment_method === 'CARD') card += amt;
    });
  });

  return {
    cash,
    upi,
    card,
    total: cash + upi + card,
  };
}

export async function fetchDailyReconciliation(dateStr: string): Promise<DailyReconciliation | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('daily_reconciliations')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();
    if (!error && data) return data;
  }

  initializeStorage();
  const list = loadLocal<DailyReconciliation[]>(STORAGE_KEY_RECONCILIATIONS, []);
  return list.find(r => r.date === dateStr) || null;
}

export async function fetchReconciliationHistory(
  startDate?: string,
  endDate?: string
): Promise<DailyReconciliation[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('daily_reconciliations').select('*').order('date', { ascending: false });
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data } = await query;
    if (data) return data;
  }

  initializeStorage();
  const list = loadLocal<DailyReconciliation[]>(STORAGE_KEY_RECONCILIATIONS, []);
  return list
    .filter(r => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveDailyReconciliation(
  data: Omit<DailyReconciliation, 'id' | 'created_at' | 'updated_at'>
): Promise<DailyReconciliation> {
  const now = new Date().toISOString();
  const existing = await fetchDailyReconciliation(data.date);
  const actionType: AuditLogAction = existing ? 'RECONCILIATION_EDITED' : 'RECONCILIATION_CLOSED';

  if (isSupabaseConfigured && supabase) {
    const { data: saved, error } = await supabase
      .from('daily_reconciliations')
      .upsert({
        date: data.date,
        cash_expected: Number(data.cash_expected),
        cash_actual: Number(data.cash_actual),
        upi_expected: Number(data.upi_expected),
        upi_actual: Number(data.upi_actual),
        card_expected: Number(data.card_expected),
        card_actual: Number(data.card_actual),
        variance: Number(data.variance),
        status: data.status,
        notes: data.notes || null,
        closed_by: data.closed_by || 'Ground Admin',
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return saved;
  }

  initializeStorage();
  const list = loadLocal<DailyReconciliation[]>(STORAGE_KEY_RECONCILIATIONS, []);
  const idx = list.findIndex(r => r.date === data.date);

  const newRec: DailyReconciliation = {
    id: existing ? existing.id : `rec-eod-${Date.now()}`,
    date: data.date,
    cash_expected: Number(data.cash_expected),
    cash_actual: Number(data.cash_actual),
    upi_expected: Number(data.upi_expected),
    upi_actual: Number(data.upi_actual),
    card_expected: Number(data.card_expected),
    card_actual: Number(data.card_actual),
    variance: Number(data.variance),
    status: data.status,
    notes: data.notes || null,
    closed_by: data.closed_by || 'Ground Admin',
    created_at: existing ? existing.created_at : now,
    updated_at: now,
  };

  if (idx !== -1) {
    list[idx] = newRec;
  } else {
    list.unshift(newRec);
  }

  saveLocal(STORAGE_KEY_RECONCILIATIONS, list);
  return newRec;
}

export function computeReconciliationMetrics(records: DailyReconciliation[]): ReconciliationReportMetrics {
  let totalVariance = 0;
  let totalDaysClosed = records.length;
  let daysWithMismatch = 0;
  let totalExpected = 0;
  let totalActual = 0;

  records.forEach(r => {
    totalVariance += Number(r.variance || 0);
    if (r.variance !== 0 || r.status === 'VARIANCE_FOUND') {
      daysWithMismatch += 1;
    }
    totalExpected += (Number(r.cash_expected) + Number(r.upi_expected) + Number(r.card_expected));
    totalActual += (Number(r.cash_actual) + Number(r.upi_actual) + Number(r.card_actual));
  });

  return {
    totalVariance,
    totalDaysClosed,
    daysWithMismatch,
    totalExpected,
    totalActual,
  };
}

// --- BROKER MANAGEMENT & REPORTING ---

export async function fetchBrokers(): Promise<Broker[]> {
  initializeStorage();
  return loadLocal<Broker[]>(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);
}

export async function saveBroker(brokerData: Partial<Broker> & { name: string; phone: string }): Promise<Broker> {
  initializeStorage();
  const brokers = loadLocal<Broker[]>(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);

  if (brokerData.id) {
    const idx = brokers.findIndex(b => b.id === brokerData.id);
    if (idx !== -1) {
      brokers[idx] = {
        ...brokers[idx],
        name: brokerData.name.trim(),
        phone: brokerData.phone.trim(),
        notes: brokerData.notes !== undefined ? (brokerData.notes?.trim() || null) : brokers[idx].notes,
        is_active: brokerData.is_active !== undefined ? brokerData.is_active : brokers[idx].is_active,
      };
      saveLocal(STORAGE_KEY_BROKERS, brokers);
      return brokers[idx];
    }
  }

  // Generate sequence code BRK-001, BRK-002, etc.
  const existingNums = brokers
    .map(b => {
      const match = b.code?.match(/BRK-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n) && n > 0);
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : brokers.length + 1;
  const autoCode = `BRK-${String(nextNum).padStart(3, '0')}`;

  const newBroker: Broker = {
    id: `br-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: brokerData.name.trim(),
    phone: brokerData.phone.trim(),
    code: brokerData.code || autoCode,
    notes: brokerData.notes?.trim() || null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  brokers.push(newBroker);
  saveLocal(STORAGE_KEY_BROKERS, brokers);
  return newBroker;
}

export async function toggleBrokerStatus(brokerId: string): Promise<Broker> {
  initializeStorage();
  const brokers = loadLocal<Broker[]>(STORAGE_KEY_BROKERS, DEFAULT_BROKERS);
  const idx = brokers.findIndex(b => b.id === brokerId);
  if (idx === -1) throw new Error('Broker not found');

  brokers[idx] = {
    ...brokers[idx],
    is_active: !brokers[idx].is_active,
  };
  saveLocal(STORAGE_KEY_BROKERS, brokers);
  return brokers[idx];
}

export async function fetchBrokerStats(brokerId: string): Promise<BrokerStats> {
  const brokers = await fetchBrokers();
  const broker = brokers.find(b => b.id === brokerId);
  if (!broker) {
    return {
      broker_id: brokerId,
      broker_name: 'Broker',
      code: 'BRK-000',
      is_active: true,
      total_bookings: 0,
      total_hours: 0,
      today_bookings: 0,
      this_month_bookings: 0,
      upcoming_bookings: 0,
    };
  }

  const allBookings = await fetchBookings();
  const brokerBookings = allBookings.filter(b => b.broker_id === brokerId && !b.is_cancelled);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const currentMonthStr = format(now, 'yyyy-MM');

  let total_hours = 0;
  let today_bookings = 0;
  let this_month_bookings = 0;
  let upcoming_bookings = 0;

  for (const b of brokerBookings) {
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    const durationHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    total_hours += durationHours;

    if (b.booking_date === todayStr) {
      today_bookings++;
    }
    if (b.booking_date && b.booking_date.startsWith(currentMonthStr)) {
      this_month_bookings++;
    }
    if (start.getTime() > now.getTime()) {
      upcoming_bookings++;
    }
  }

  return {
    broker_id: broker.id,
    broker_name: broker.name,
    code: broker.code,
    broker_code: broker.code,
    is_active: broker.is_active,
    total_bookings: brokerBookings.length,
    total_hours: Math.round(total_hours * 10) / 10,
    total_hours_booked: Math.round(total_hours * 10) / 10,
    today_bookings,
    this_month_bookings,
    upcoming_bookings,
  };
}

export async function fetchBrokerOperationalReport(): Promise<BrokerOperationalReportItem[]> {
  const brokers = await fetchBrokers();
  const allBookings = await fetchBookings();
  const now = new Date();
  const currentMonthStr = format(now, 'yyyy-MM');

  return brokers.map(br => {
    const brBookings = allBookings.filter(b => b.broker_id === br.id && !b.is_cancelled);
    let total_hours = 0;
    let this_month_bookings = 0;

    for (const b of brBookings) {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const durationHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
      total_hours += durationHours;

      if (b.booking_date && b.booking_date.startsWith(currentMonthStr)) {
        this_month_bookings++;
      }
    }

    return {
      broker_id: br.id,
      broker_name: br.name,
      code: br.code,
      broker_code: br.code,
      phone: br.phone,
      total_bookings: brBookings.length,
      total_hours: Math.round(total_hours * 10) / 10,
      total_hours_booked: Math.round(total_hours * 10) / 10,
      this_month_bookings,
      status: br.is_active ? 'ACTIVE' : 'DISABLED',
    };
  });
}

/**
 * PRIVACY MASKING UTILITY
 * In Broker role, other brokers' bookings and direct bookings are masked to "BOOKED"
 * with customer details, phone numbers, and financial data stripped out.
 */
export function getMaskedBookingsForRole(
  bookings: Booking[],
  role: UserRole,
  activeBrokerId: string | null
): Booking[] {
  if (role === 'OWNER') {
    return bookings.map(b => ({
      ...b,
      is_masked: false,
    }));
  }

  return bookings.map(b => {
    // If booked by this active broker, return full details
    if (b.broker_id && activeBrokerId && b.broker_id === activeBrokerId) {
      return {
        ...b,
        is_masked: false,
      };
    }

    // Otherwise mask into privacy-safe booked slot
    return {
      ...b,
      is_masked: true,
      team_a_name: 'BOOKED',
      team_b_name: null,
      contact_person: undefined,
      customer_phone: undefined,
      notes: null,
      customer: undefined,
      payments: [],
      audit_logs: [],
      base_amount: 0,
      total_amount: 0,
      total_paid: 0,
      pending_amount: 0,
      custom_pending_amount: null,
      discount_type: 'NONE',
      discount_value: 0,
      discount_amount: 0,
      discount_reason: null,
    };
  });
}
