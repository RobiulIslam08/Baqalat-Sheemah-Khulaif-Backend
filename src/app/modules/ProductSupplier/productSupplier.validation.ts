import { z } from 'zod';

const createProductSupplierValidationSchema = z.object({
  body: z.object({
    productCode: z.string({ message: 'Product code is required' }).trim(),
    productName: z.string({ message: 'Product name is required' }).trim(),
    supplierName: z.string({ message: 'Supplier name is required' }).trim(),
    purchasePrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    notes: z.string().trim().optional(),
  }),
});

export const ProductSupplierValidation = { createProductSupplierValidationSchema };
