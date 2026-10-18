import { z } from 'zod';

export const onboardDeviceValidationSchema = z.object({
  body: z.object({
    branchId: z.string().trim(),
    otp: z.string().trim().length(6, 'OTP must be exactly 6 digits'),
    deviceName: z.string().trim().optional().default('POS Terminal 01'),
    vatNumber: z
      .string()
      .trim()
      .length(15, 'VAT number must be 15 digits')
      .regex(/^3.*3$/, 'Saudi VAT number must start and end with digit 3'),
    taxpayerName: z.string().trim(),
    branchName: z.string().trim().optional(),
    businessCategory: z.string().trim().optional().default('Food and Beverage'),
    crn: z.string().trim().optional(),
    streetName: z.string().trim(),
    buildingNumber: z.string().trim(),
    citySubdivision: z.string().trim().optional(),
    cityName: z.string().trim(),
    postalCode: z.string().trim(),
    environment: z.enum(['sandbox', 'simulation', 'production']).optional().default('sandbox'),
  }),
});

export const processInvoiceValidationSchema = z.object({
  body: z.object({
    branchId: z.string().trim(),
    saleId: z.string().trim().optional(),
    invoiceNumber: z.string().trim(),
    uuid: z.string().uuid().optional(),
    invoiceType: z.enum(['standard', 'simplified']),
    transactionType: z.enum(['invoice_388', 'credit_note_381', 'debit_note_383']).optional().default('invoice_388'),
    billingReferenceId: z.string().trim().optional(),
    issueDatetime: z.string().or(z.date()).optional(),
    paymentMeansCode: z.string().trim().optional().default('10'),

    customer: z
      .object({
        name: z.string().trim(),
        vatNumber: z.string().trim().length(15).optional(),
        crn: z.string().trim().optional(),
        streetName: z.string().trim().optional(),
        buildingNumber: z.string().trim().optional(),
        citySubdivision: z.string().trim().optional(),
        cityName: z.string().trim().optional(),
        postalCode: z.string().trim().optional(),
        countryCode: z.string().trim().optional().default('SA'),
      })
      .optional(),

    items: z.array(
      z.object({
        name: z.string().trim(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().optional().default(0),
        vatRate: z.number().nonnegative().optional().default(15),
        vatCategory: z.enum(['S', 'Z', 'E', 'O']).optional().default('S'),
        unitCode: z.string().trim().optional().default('PCE'),
      })
    ).min(1, 'At least one invoice item is required'),

    totalExclusiveVat: z.number().nonnegative(),
    totalVatAmount: z.number().nonnegative(),
    totalInclusiveVat: z.number().nonnegative(),
  }),
});
