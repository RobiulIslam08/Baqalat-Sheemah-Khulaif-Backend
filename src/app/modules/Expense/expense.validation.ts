import { z } from 'zod';

const createExpenseValidationSchema = z.object({
  body: z.object({
    voucherNo: z.string({ message: 'Voucher number is required' }).trim(),
    expenseDate: z.string({ message: 'Expense date is required' }),
    category: z.string({ message: 'Category is required' }).trim(),
    paidTo: z.string({ message: 'Paid to is required' }).trim(),
    amount: z.number({ message: 'Amount is required' }).min(0.01, { message: 'Amount must be greater than 0' }),
    vat: z.number().min(0).default(15),
    netAmount: z.number({ message: 'Net amount is required' }),
    paymentMode: z.string().trim().default('Cash'),
    remarks: z.string().trim().optional(),
  }),
});

export const ExpenseValidation = { createExpenseValidationSchema };
