import { z } from 'zod';

const purchaseItemSchema = z.object({
  barcode: z.string().trim().optional(),
  itemName: z.string({ message: 'Item name is required' }).trim(),
  batch: z.string().trim().optional(),
  expiryDate: z.string().optional(),
  totalQty: z.number({ message: 'Quantity is required' }).min(0),
  free: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  discountAmt: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  purchasePrice: z.number({ message: 'Purchase price is required' }).min(0),
  netAmount: z.number({ message: 'Net amount is required' }),
});

const createPurchaseValidationSchema = z.object({
  body: z.object({
    invoiceNo: z.string({ message: 'Invoice number is required' }).trim(),
    invoiceDate: z.string({ message: 'Invoice date is required' }),
    supplier: z.string().optional(),
    purchaseOrderNo: z.string().trim().optional(),
    items: z.array(purchaseItemSchema).min(1, { message: 'At least one item is required' }),
    netAmount: z.number(),
    discount: z.number().min(0).default(0),
    vat: z.number().min(0).default(0),
    totalAmount: z.number(),
    paymentMethod: z.enum(['readyCash', 'creditCard']).default('readyCash'),
  }),
});

export const PurchaseValidation = { createPurchaseValidationSchema };
