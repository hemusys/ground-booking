import { z } from 'zod';

export const quickBookingSchema = z
  .object({
    facility_id: z.string().min(1, 'Facility is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date (YYYY-MM-DD) is required'),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Valid start time (HH:mm) is required'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Valid end time (HH:mm) is required'),
    customer_phone: z.string().min(5, 'Phone number must be at least 5 digits'),
    customer_name: z.string().min(1, 'Customer name is required'),
    team_name: z.string().optional(),
    team_a_name: z.string().optional(),
    team_b_name: z.string().optional().nullable(),
    booking_source: z.enum(['DIRECT', 'BROKER', 'ONLINE']).optional(),
    broker_id: z.string().optional().nullable(),
    discount_type: z.enum(['NONE', 'PERCENTAGE', 'FIXED']).optional(),
    discount_value: z.number().optional(),
    discount_reason: z.string().optional().nullable(),
    total_amount: z.number().min(0, 'Total amount must be greater than or equal to 0'),
    advance_paid: z.number().min(0, 'Advance paid must be greater than or equal to 0'),
    custom_pending_amount: z
      .number()
      .min(0, 'Due amount cannot be negative')
      .optional()
      .nullable(),
    pending_adjustment_reason: z.string().optional().nullable(),
    allow_due_override: z.boolean().default(false),
    payment_method: z.enum(['UPI', 'CASH', 'CARD']),
    notes: z.string().optional(),
    repeat_type: z.enum(['NONE', 'DAILY', 'WEEKLY', 'CUSTOM_WEEKDAYS']).optional(),
    repeat_end_date: z.string().optional(),
    repeat_weekdays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).optional(),
    allow_blacklist_override: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Validate start and end times
    const [sh, sm] = data.start_time.split(':').map(Number);
    const [eh, em] = data.end_time.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    if (endMins <= startMins) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['end_time'],
      });
    }

    // 2. Validate pending balance
    const naturalCalculatedDue = Math.max(0, data.total_amount - data.advance_paid);
    const userDue =
      data.custom_pending_amount !== undefined && data.custom_pending_amount !== null
        ? data.custom_pending_amount
        : naturalCalculatedDue;

    if (userDue < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Due amount cannot be negative (must be >= 0)',
        path: ['custom_pending_amount'],
      });
    }

    if (!data.allow_due_override && userDue > data.total_amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Due amount cannot exceed total fee unless explicitly overridden',
        path: ['custom_pending_amount'],
      });
    }

    // 3. If due differs from calculated balance, require adjustment reason
    if (
      data.custom_pending_amount !== undefined &&
      data.custom_pending_amount !== null &&
      data.custom_pending_amount !== naturalCalculatedDue
    ) {
      if (!data.pending_adjustment_reason || !data.pending_adjustment_reason.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Adjustment reason is required when pending due differs from calculated balance',
          path: ['pending_adjustment_reason'],
        });
      }
    }
  });

export type QuickBookingSchemaType = z.infer<typeof quickBookingSchema>;
