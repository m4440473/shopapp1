import { z } from 'zod';

const optionalText = z
  .string()
  .transform((val) => val.trim())
  .optional();

export const CustomerUpdate = z.object({
  name: z
    .string()
    .transform((val) => val.trim())
    .min(1, 'Name is required')
    .optional(),
  contact: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
});

export type CustomerUpdateInput = z.infer<typeof CustomerUpdate>;
