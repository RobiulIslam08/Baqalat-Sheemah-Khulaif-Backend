import { z } from 'zod';

const createCustomerValidationSchema = z.object({
  body: z.object({
    customerCode: z.string({ message: 'Customer code is required' }).trim(),
    customerName: z.string({ message: 'Customer name is required' }).trim(),
    mobile: z.string().trim().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    creditLimit: z.number().min(0).optional(),
    address: z.string().trim().optional(),
  }),
});

const updateCustomerValidationSchema = z.object({
  body: z.object({
    customerName: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    creditLimit: z.number().min(0).optional(),
    address: z.string().trim().optional(),
  }),
});

export const CustomerValidation = { createCustomerValidationSchema, updateCustomerValidationSchema };
