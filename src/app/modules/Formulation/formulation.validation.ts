import { z } from 'zod';

const createFormulationValidationSchema = z.object({
  body: z.object({
    formulationCode: z.string({ message: 'Formulation code is required' }).trim(),
    formulationName: z.string({ message: 'Formulation name is required' }).trim(),
    group: z.string().trim().optional(),
    strength: z.string().trim().optional(),
    manufacturer: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

const updateFormulationValidationSchema = z.object({
  body: z.object({
    formulationName: z.string().trim().optional(),
    group: z.string().trim().optional(),
    strength: z.string().trim().optional(),
    manufacturer: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const FormulationValidation = { createFormulationValidationSchema, updateFormulationValidationSchema };
