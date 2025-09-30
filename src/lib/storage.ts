import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { slugifyName, type BusinessName } from './businesses';

export {
  BUSINESS_NAMES,
  BUSINESS_OPTIONS,
  BUSINESS_CODES,
  BUSINESS_PREFIX_BY_CODE,
  businessCodeFromName,
  businessNameFromCode,
  businessPrefixFromCode,
  slugifyName,
} from './businesses';
export type { BusinessName, BusinessOption, BusinessCode } from './businesses';

export const ATTACHMENTS_ROOT = process.env.ATTACHMENTS_DIR ?? 'storage';

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

export interface StoreAttachmentFileOptions {
  business: BusinessName;
  customerName: string;
  referenceNumber: string;
  originalFilename: string;
  buffer: Buffer;
  rootDir?: string;
}

export interface StoreAttachmentFileResult {
  storagePath: string;
  absolutePath: string;
  filename: string;
}

export async function storeAttachmentFile({
  business,
  customerName,
  referenceNumber,
  originalFilename,
  buffer,
  rootDir = ATTACHMENTS_ROOT,
}: StoreAttachmentFileOptions): Promise<StoreAttachmentFileResult> {
  const { relativeDirectory, absoluteDirectory } = await buildAttachmentPath(
    business,
    customerName,
    referenceNumber,
    rootDir,
  );

  const extension = path.extname(originalFilename || '').toLowerCase();
  const baseName = slugifyName(originalFilename?.replace(extension, '') ?? '', 'attachment');
  const uniqueId = randomUUID();
  const filename = `${baseName}-${uniqueId}${extension}`;
  const absolutePath = path.join(absoluteDirectory, filename);
  const storagePath = path.posix.join(relativeDirectory, filename);

  await writeFile(absolutePath, buffer);

  return { storagePath, absolutePath, filename };
}
