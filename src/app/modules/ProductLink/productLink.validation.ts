import { z } from 'zod';

const createProductLinkValidationSchema = z.object({
  body: z.object({
    boxProductCode: z.string({ message: 'Box product code is required' }).trim(),
    boxProductName: z.string({ message: 'Box product name is required' }).trim(),
    singleProductCode: z.string({ message: 'Single product code is required' }).trim(),
    singleProductName: z.string({ message: 'Single product name is required' }).trim(),
    conversionQty: z.number({ message: 'Conversion quantity is required' }).min(1),
    remark: z.string().trim().optional(),
  }),
});

export const ProductLinkValidation = { createProductLinkValidationSchema };
