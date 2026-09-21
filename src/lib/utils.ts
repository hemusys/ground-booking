import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInMinutes } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimeDisplay(isoString: string): string {
  try {
    return format(parseISO(isoString), 'hh:mm a');
  } catch {
    return isoString;
  }
}

export function formatDateDisplay(isoString: string): string {
  try {
    return format(parseISO(isoString), 'EEE, dd MMM yyyy');
  } catch {
    return isoString;
  }
}

export function formatShortDate(isoString: string): string {
  try {
    return format(parseISO(isoString), 'dd MMM');
  } catch {
    return isoString;
  }
}

export function getDurationHours(startIso: string, endIso: string): number {
  try {
    const mins = differenceInMinutes(parseISO(endIso), parseISO(startIso));
    return Math.max(0, mins / 60);
  } catch {
    return 1;
  }
}

export function getDurationDisplay(startIso: string, endIso: string): string {
  try {
    const mins = differenceInMinutes(parseISO(endIso), parseISO(startIso));
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    
    if (hours === 0) return `${remainingMins} mins`;
    if (remainingMins === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
    return `${hours}h ${remainingMins}m`;
  } catch {
    return '1 hr';
  }
}

/**
 * Generate standard WhatsApp direct chat link
 */
export function generateWhatsAppLink(params: {
  phone: string;
  facilityName: string;
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  totalAmount: number;
  advancePaid: number;
  pendingAmount: number;
}): string {
  // Normalize phone (strip non-digits, ensure +91 / 91 prefix for Indian mobile)
  let cleanPhone = params.phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const message = 
`🏏 *Ground Manager Booking Confirmed*

*Facility:* ${params.facilityName}
*Date:* ${params.dateStr}
*Time:* ${params.startTimeStr} - ${params.endTimeStr}

*Total:* ₹${params.totalAmount.toLocaleString('en-IN')}
*Advance Paid:* ₹${params.advancePaid.toLocaleString('en-IN')}
*Pending:* ₹${params.pendingAmount.toLocaleString('en-IN')}

Thank you! For any queries, reply to this message.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Clean phone number for tel: link
 */
export function generateTelLink(phone: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  return `tel:${cleanPhone}`;
}
