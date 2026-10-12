import { z } from 'zod';

const generateBarcodeValidationSchema = z.object({
  body: z.object({
    productCode: z.string({ message: 'Product code is required' }).trim(),
    barcodeValue: z.string().trim().optional(),
    labelCount: z.number().min(1).max(80).default(12),
    paperSize: z.string().default('40x25'),
    printType: z.string().default('Sticker'),
    printer: z.string({ message: 'Printer is required' }).trim(),
  }),
});

export const BarcodeValidation = { generateBarcodeValidationSchema };
