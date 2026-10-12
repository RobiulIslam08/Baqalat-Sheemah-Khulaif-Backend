import { z } from 'zod';

const createTicketValidationSchema = z.object({
  body: z.object({
    subject: z.string({ message: 'Subject is required' }).trim(),
    section: z.string({ message: 'Section is required' }).trim(),
    priority: z.enum(['Low', 'Normal', 'High', 'Critical']).default('Normal'),
    description: z.string({ message: 'Description is required' }).trim(),
  }),
});

const updateTicketValidationSchema = z.object({
  body: z.object({
    status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
    priority: z.enum(['Low', 'Normal', 'High', 'Critical']).optional(),
  }),
});

export const TicketValidation = { createTicketValidationSchema, updateTicketValidationSchema };
