import { z } from 'zod';

const createCashAdjustmentValidationSchema = z.object({
  body: z.object({
    adjustmentNo: z.string({ message: 'Adjustment number is required' }).trim(),
    type: z.enum(['In', 'Out']),
    amount: z.number({ message: 'Amount is required' }).min(0.01),
    account: z.string({ message: 'Account is required' }).trim(),
    date: z.string({ message: 'Date is required' }),
    remarks: z.string().trim().optional(),
  }),
});

export const CashAdjustmentValidation = { createCashAdjustmentValidationSchema };
