import path from 'node:path';
import { mkdir } from 'node:fs/promises';

export const ATTACHMENTS_ROOT = process.env.ATTACHMENTS_DIR ?? 'storage';

export const BUSINESS_NAMES = [
  'Sterling Tool and Die',
  'C and R Machining',
  'Powder Coating',
] as const;

export type BusinessName = (typeof BUSINESS_NAMES)[number];

export interface BusinessOption {
  name: BusinessName;
  slug: string;
}

export function slugifyName(
  value: string | null | undefined,
  fallback = 'item',
): string {
  const base = value?.toString().trim() ?? '';
  const normalized = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

export const BUSINESS_OPTIONS = BUSINESS_NAMES.map((name) => ({
  name,
  slug: slugifyName(name, 'business'),
})) as const satisfies readonly BusinessOption[];

export async function ensureAttachmentRoot(
  rootDir: string = ATTACHMENTS_ROOT,
): Promise<string> {
  const absoluteRoot = path.resolve(rootDir);
  await mkdir(absoluteRoot, { recursive: true });
  return absoluteRoot;
}

export interface AttachmentPathInfo {
  relativeDirectory: string;
  absoluteDirectory: string;
}

export async function buildAttachmentPath(
  business: BusinessName,
  customerName: string,
  referenceNumber: string,
  rootDir: string = ATTACHMENTS_ROOT,
): Promise<AttachmentPathInfo> {
  const absoluteRoot = await ensureAttachmentRoot(rootDir);
  const businessSlug = slugifyName(business, 'business');
  const customerSlug = slugifyName(customerName, 'customer');
  const referenceSlug = slugifyName(referenceNumber, 'reference');

  const relativeDirectory = [businessSlug, customerSlug, referenceSlug].join('/');
  const absoluteDirectory = path.join(
    absoluteRoot,
    businessSlug,
    customerSlug,
    referenceSlug,
  );

  await mkdir(absoluteDirectory, { recursive: true });

  return { relativeDirectory, absoluteDirectory };
}
