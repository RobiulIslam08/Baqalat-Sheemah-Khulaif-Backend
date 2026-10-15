import { z } from 'zod';

const updateSettingsValidationSchema = z.object({
  body: z.object({
    storeName: z.string().trim().optional(),
    storeNameAr: z.string().trim().optional(),
    storeNameEn: z.string().trim().optional(),
    vatNumber: z.string().trim().optional(),
    invoicePrefix: z.string().trim().optional(),
    defaultPayment: z.string().trim().optional(),
    timezone: z.string().trim().optional(),
    supportContact: z.string().trim().optional(),
    lowStockAlert: z.preprocess((val) => (val === '' || val === undefined || val === null ? undefined : Number(val)), z.number().optional()),
    allowNegativeStock: z.enum(['yes', 'no']).optional(),
    currency: z.string().trim().optional(),
    currencySymbol: z.string().trim().optional(),
    vatPercent: z.number().min(0).max(100).optional(),
    defaultLanguage: z.enum(['en', 'ar']).optional(),
    invoiceLanguage: z.enum(['ar', 'en', 'both']).optional(),
    dateLocale: z.string().trim().optional(),
    timeLocale: z.string().trim().optional(),
    receiptHeader: z.string().trim().optional(),
    receiptFooter: z.string().trim().optional(),
    storeAddress: z.string().trim().optional(),
    crNumber: z.string().trim().optional(),
    logo: z
      .string()
      .max(1_200_000)
      .refine(
        (value) => value === '' || /^data:image\/(png|jpeg|webp);base64,/.test(value),
        'Logo must be a PNG, JPEG, or WebP image',
      )
      .optional(),
  }),
});

export const SettingsValidation = { updateSettingsValidationSchema };
