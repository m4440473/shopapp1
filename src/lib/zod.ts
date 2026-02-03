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
  affectsPrice: z.boolean().default(true),
  isChecklistItem: z.boolean().default(true),
  departmentId: Id,
});
export const AddonPatch = AddonUpsert.partial();

/** DEPARTMENTS */
export const DepartmentUpsert = z.object({
  name: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export const DepartmentPatch = DepartmentUpsert.partial();

/** CUSTOM FIELDS */
export const CustomFieldEntityType = z.enum(['ORDER', 'QUOTE']);
export const CustomFieldType = z.enum([
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTISELECT',
]);
export const CustomFieldOptionInput = z.object({
  label: z.string().trim().min(1).max(200),
  value: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});
export const CustomFieldUpsert = z.object({
  entityType: CustomFieldEntityType,
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().min(2).max(120),
  fieldType: CustomFieldType,
  description: z.string().trim().max(500).optional(),
  businessCode: z.string().trim().max(20).optional(),
  defaultValue: z.unknown().optional(),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  options: z.array(CustomFieldOptionInput).optional(),
});
export const CustomFieldPatch = CustomFieldUpsert.partial();

/** DOCUMENT TEMPLATES */
export const DocumentType = z.enum(['QUOTE', 'INVOICE', 'ORDER_PRINT']);
export const DocumentTemplateUpsert = z.object({
  name: z.string().trim().min(2).max(160),
  documentType: DocumentType,
  description: z.string().trim().max(500).optional(),
  businessCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  schemaVersion: z.coerce.number().int().min(1).max(999).default(1),
  layoutJson: z.unknown(),
});
export const DocumentTemplatePatch = DocumentTemplateUpsert.partial();

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
export type TDepartmentUpsert = z.infer<typeof DepartmentUpsert>;
export type TDepartmentPatch = z.infer<typeof DepartmentPatch>;
export type TCustomFieldUpsert = z.infer<typeof CustomFieldUpsert>;
export type TCustomFieldPatch = z.infer<typeof CustomFieldPatch>;
export type TDocumentTemplateUpsert = z.infer<typeof DocumentTemplateUpsert>;
export type TDocumentTemplatePatch = z.infer<typeof DocumentTemplatePatch>;
