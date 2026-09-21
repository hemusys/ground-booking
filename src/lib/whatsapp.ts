import { formatDateDisplay, formatTimeDisplay } from './utils';

export interface WhatsAppBookingParams {
  phone: string;
  customerName?: string;
  facilityName: string;
  startIso: string;
  endIso: string;
  totalAmount: number;
  advancePaid: number;
  pendingAmount: number;
  groundName?: string;
}

export const DEFAULT_REMINDER_TEMPLATE = 
`🏏 *{ground_name} — Payment Due Reminder*

Hi {customer_name}, your booking for *{facility_name}* on *{date} ({time})* has a pending balance:

• Total Fee: ₹{total_amount}
• Paid So Far: ₹{paid_amount}
• *Pending Due: ₹{due_amount}*

Kindly clear the balance upon arrival via UPI or Cash. Thank you!`;

/**
 * Standardize phone number for WhatsApp deep link (+91 default for 10-digit Indian numbers)
 */
export function formatWhatsAppPhone(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
}

/**
 * Encodes text into a standard wa.me URL
 */
export function buildWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Interpolates placeholders in a reminder message template
 */
export function interpolateReminderTemplate(
  template: string,
  params: WhatsAppBookingParams
): string {
  const dateStr = formatDateDisplay(params.startIso);
  const timeStr = `${formatTimeDisplay(params.startIso)} - ${formatTimeDisplay(params.endIso)}`;
  const ground = params.groundName?.trim() || 'Ground Manager';
  const customer = params.customerName?.trim() || 'Player';

  return template
    .replace(/{ground_name}/g, ground)
    .replace(/{customer_name}/g, customer)
    .replace(/{facility_name}/g, params.facilityName)
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr)
    .replace(/{total_amount}/g, params.totalAmount.toLocaleString('en-IN'))
    .replace(/{paid_amount}/g, params.advancePaid.toLocaleString('en-IN'))
    .replace(/{due_amount}/g, params.pendingAmount.toLocaleString('en-IN'));
}

/**
 * Builds standard wa.me deep link for instant booking confirmation without Meta API.
 */
export function buildWhatsAppBookingLink(params: WhatsAppBookingParams): string {
  const dateStr = formatDateDisplay(params.startIso);
  const timeStr = `${formatTimeDisplay(params.startIso)} - ${formatTimeDisplay(params.endIso)}`;
  const ground = params.groundName?.trim() || 'Ground Manager';
  const customer = params.customerName?.trim() || 'Player';

  const message =
`🏏 *${ground} Booking Confirmed*

Hi ${customer}, your booking for *${params.facilityName}* is confirmed!

*Date:* ${dateStr}
*Time:* ${timeStr}

*Total:* ₹${params.totalAmount.toLocaleString('en-IN')}
*Advance Paid:* ₹${params.advancePaid.toLocaleString('en-IN')}
*Pending:* ₹${params.pendingAmount.toLocaleString('en-IN')}

Thank you! For queries or pitch access, reply directly.`;

  return buildWhatsAppUrl(params.phone, message);
}

/**
 * Builds reminder wa.me link for due balance recovery.
 */
export function buildWhatsAppDueReminderLink(
  params: WhatsAppBookingParams,
  customTemplate?: string
): string {
  const template = customTemplate || DEFAULT_REMINDER_TEMPLATE;
  const message = interpolateReminderTemplate(template, params);
  return buildWhatsAppUrl(params.phone, message);
}
