import { z } from 'zod';

const createSupplierValidationSchema = z.object({
  body: z.object({
    supplierCode: z.string({ message: 'Supplier code is required' }).trim(),
    supplierName: z.string({ message: 'Supplier name is required' }).trim(),
    contactPerson: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    creditLimit: z.number().min(0).optional(),
    address: z.string().trim().optional(),
  }),
});

const updateSupplierValidationSchema = z.object({
  body: z.object({
    supplierName: z.string().trim().optional(),
    contactPerson: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    creditLimit: z.number().min(0).optional(),
    address: z.string().trim().optional(),
  }),
});

export const SupplierValidation = {
  createSupplierValidationSchema,
  updateSupplierValidationSchema,
};
