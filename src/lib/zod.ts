// src/lib/zod.ts
import { z } from 'zod';

/** Shared */
export const Id = z.string().min(1);
export const Cursor = z.string().optional();
export const Take = z.coerce.number().int().min(1).max(100).default(20);
export const Q = z.string().min(1).max(200).optional();

export const RoleEnum = z.enum(['ADMIN', 'MACHINIST', 'VIEWER']);

/** USERS */
const Password = z.string().min(8).max(100);

export const UserCreate = z.object({
  email: z.string().email(),
  name: z.string().trim().max(100).optional(),
  role: RoleEnum.default('MACHINIST'),
  active: z.boolean().default(true),
  password: Password.optional(),
});
export const UserUpdate = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().max(100).optional(),
  role: RoleEnum.optional(),
  active: z.boolean().optional(),
  password: Password.optional(),
});
export const UserUpsert = UserCreate;           // for POST
export const UserPatch = UserUpdate.partial();  // for PATCH

/** MATERIALS */
export const MaterialUpsert = z.object({
  name: z.string().trim().min(2).max(100),
  spec: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});
export const MaterialPatch = MaterialUpsert.partial();

/** VENDORS */
export const VendorUpsert = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().url().max(300).optional(),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});
export const VendorPatch = VendorUpsert.partial();

/** ADDONS */
export const AddonRateType = z.enum(['HOURLY', 'FLAT']);
export const AddonUpsert = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  rateType: AddonRateType.default('HOURLY'),
  rateCents: z.coerce.number().int().min(0).max(10_000_000),
  active: z.boolean().default(true),
});
export const AddonPatch = AddonUpsert.partial();

/** Common query schema for list endpoints: ?q=&cursor=&take= */
export const ListQuery = z.object({
  q: Q,
  cursor: Cursor,
  take: Take,
});

/** Helpers */
export type TUserCreate = z.infer<typeof UserCreate>;
export type TUserPatch = z.infer<typeof UserPatch>;
export type TMaterialUpsert = z.infer<typeof MaterialUpsert>;
export type TMaterialPatch = z.infer<typeof MaterialPatch>;
export type TVendorUpsert = z.infer<typeof VendorUpsert>;
export type TVendorPatch = z.infer<typeof VendorPatch>;
export type TListQuery = z.infer<typeof ListQuery>;
export type TAddonUpsert = z.infer<typeof AddonUpsert>;
export type TAddonPatch = z.infer<typeof AddonPatch>;
