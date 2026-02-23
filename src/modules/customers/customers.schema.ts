import { z } from 'zod';

const optionalText = z.string().trim().optional();

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  contact: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
});

export const customerUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  contact: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
