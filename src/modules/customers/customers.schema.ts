import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalEmail = optionalText(200).refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Enter a valid email',
);

export const customerContactInputSchema = z.object({
  id: optionalText(100),
  name: z.string().trim().min(1, 'Contact name is required').max(200),
  title: optionalText(120),
  phone: optionalText(50),
  fax: optionalText(50),
  email: optionalEmail,
  isPrimary: z.boolean().optional(),
});

const legacyAndAddressFields = {
  contact: optionalText(200),
  phone: optionalText(50),
  fax: optionalText(50),
  email: optionalEmail,
  address: optionalText(1000),
  addressLine1: optionalText(300),
  addressLine2: optionalText(300),
  city: optionalText(120),
  stateProvince: optionalText(120),
  postalCode: optionalText(30),
  country: optionalText(120),
  contacts: z.array(customerContactInputSchema).max(100).optional(),
};

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  ...legacyAndAddressFields,
});

export const customerUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  ...legacyAndAddressFields,
});

export type CustomerContactInput = z.infer<typeof customerContactInputSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
