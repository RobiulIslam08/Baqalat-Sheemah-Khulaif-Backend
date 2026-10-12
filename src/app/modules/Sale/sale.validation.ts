import { z } from 'zod';

const saleItemSchema = z.object({
  code: z.string({ message: 'Product code is required' }).trim(),
  productName: z.string({ message: 'Product name is required' }).trim(),
  batchCode: z.string().trim().optional(),
  expiryDate: z.string().optional(),
  type: z.enum(['SINGLE', 'BOX']).default('SINGLE'),
  quantity: z.number({ message: 'Quantity is required' }).min(1, { message: 'Quantity must be at least 1' }),
  price: z.number({ message: 'Price is required' }).min(0),
  vat: z.number().default(0),
  total: z.number({ message: 'Total is required' }),
});

const createSaleValidationSchema = z.object({
  body: z.object({
    customer: z.string().optional(),
    items: z.array(saleItemSchema).min(1, { message: 'At least one item is required' }),
    totalAmount: z.number(),
    discount: z.number().min(0).default(0),
    vatPercent: z.number().min(0).default(15),
    netAmount: z.number(),
    amountPaid: z.number().min(0).default(0),
    balance: z.number().default(0),
    paymentMode: z.enum(['CASH', 'CREDIT CARD']).default('CREDIT CARD'),
  }),
});

const createSalesReturnValidationSchema = z.object({
  body: z.object({
    returnReference: z.number().optional(),
    items: z.array(saleItemSchema).min(1, { message: 'At least one item is required' }),
    totalAmount: z.number(),
    discount: z.number().min(0).default(0),
    vatPercent: z.number().min(0).default(0),
    netAmount: z.number(),
    amountPaid: z.number().min(0).default(0),
    balance: z.number().default(0),
    paymentMode: z.enum(['CASH', 'CREDIT CARD']).default('CASH'),
  }),
});

export const SaleValidation = { createSaleValidationSchema, createSalesReturnValidationSchema };
