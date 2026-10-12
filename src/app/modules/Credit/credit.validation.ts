import { z } from 'zod';

const supplierCreditValidationSchema = z.object({
  body: z.object({
    supplier: z.string({ message: 'Supplier is required' }).trim(),
    invoiceNo: z.string({ message: 'Invoice number is required' }).trim(),
    dueAmount: z.number().min(0.01, { message: 'Due amount must be greater than 0' }),
    paidAmount: z.number().min(0.01, { message: 'Paid amount must be greater than 0' }),
    paymentDate: z.string({ message: 'Payment date is required' }),
    paymentMethod: z.enum(['Cash', 'Card', 'Bank Transfer']).default('Cash'),
    reference: z.string().trim().optional(),
    remarks: z.string().trim().optional(),
  }),
});

const customerCreditValidationSchema = z.object({
  body: z.object({
    customer: z.string({ message: 'Customer is required' }).trim(),
    billNo: z.string({ message: 'Bill number is required' }).trim(),
    dueAmount: z.number().min(0.01),
    receivedAmount: z.number().min(0.01),
    paymentDate: z.string({ message: 'Payment date is required' }),
    remarks: z.string().trim().optional(),
  }),
});

export const CreditValidation = { supplierCreditValidationSchema, customerCreditValidationSchema };
