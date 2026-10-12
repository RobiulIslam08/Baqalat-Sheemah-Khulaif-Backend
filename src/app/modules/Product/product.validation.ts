import { z } from 'zod';

const createProductValidationSchema = z.object({
  body: z.object({
    productId: z.string({ message: 'Product ID is required' }).trim(),
    productCode: z.string({ message: 'Product code is required' }).trim(),
    productName: z.string({ message: 'Product name is required' }).trim(),
    arabicName: z.string().trim().optional(),
    quantity: z.number().min(0).default(0),
    packageVal: z.string().trim().optional(),
    vat: z.number().refine((val) => [0, 5, 15].includes(val), {
      message: 'VAT must be 0, 5, or 15',
    }),
    mrp: z.number().min(0, { message: 'MRP cannot be negative' }),
    purchasePrice: z
      .number()
      .min(0, { message: 'Purchase price cannot be negative' }),
    sellingPrice: z
      .number()
      .min(0, { message: 'Selling price cannot be negative' }),
    storage: z.string().trim().optional(),
    minQty: z.number().min(0).default(1),
    productType: z.enum(['SINGLE', 'BOX']).default('SINGLE'),
    boxQty: z.number().min(1).default(1),
    formulation: z.string().trim().optional(),
    batchCode: z.string().trim().optional(),
    expiryDate: z.string().optional().or(z.date().optional()),
  }),
});

const updateProductValidationSchema = z.object({
  body: z.object({
    productName: z.string().trim().optional(),
    arabicName: z.string().trim().optional(),
    quantity: z.number().min(0).optional(),
    packageVal: z.string().trim().optional(),
    vat: z
      .number()
      .refine((val) => [0, 5, 15].includes(val))
      .optional(),
    mrp: z.number().min(0).optional(),
    purchasePrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    storage: z.string().trim().optional(),
    minQty: z.number().min(0).optional(),
    productType: z.enum(['SINGLE', 'BOX']).optional(),
    boxQty: z.number().min(1).optional(),
    formulation: z.string().trim().optional(),
    batchCode: z.string().trim().optional(),
    expiryDate: z.string().optional().or(z.date().optional()),
  }),
});

export const ProductValidation = {
  createProductValidationSchema,
  updateProductValidationSchema,
};
