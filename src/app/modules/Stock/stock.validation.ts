import { z } from 'zod';

const stockReturnValidationSchema = z.object({
  body: z.object({
    invoiceNo: z.string().trim().optional(),
    productCode: z.string({ message: 'Product code is required' }).trim(),
    productName: z.string({ message: 'Product name is required' }).trim(),
    returnQty: z.number({ message: 'Return quantity is required' }).min(1),
    reason: z.enum(['Expired', 'Damaged']),
    remarks: z.string().trim().optional(),
  }),
});

const stockCorrectionItemSchema = z.object({
  code: z.string().trim(),
  productName: z.string().trim(),
  batchCode: z.string().trim().optional(),
  expiryDate: z.string().optional(),
  quantity: z.number().min(0, { message: 'Quantity cannot be negative' }),
  price: z.number(),
  total: z.number(),
});

const stockCorrectionValidationSchema = z.object({
  body: z.object({
    items: z.array(stockCorrectionItemSchema).min(1),
    totalAmount: z.number(),
  }),
});

export const StockValidation = { stockReturnValidationSchema, stockCorrectionValidationSchema };
