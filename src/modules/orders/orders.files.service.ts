import 'server-only';

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { z } from 'zod';
import { isDrawingPartAttachment } from '@/lib/attachment-visibility';
import { getAppSettings } from '@/lib/app-settings';
import {
  businessNameFromCode,
  slugifyName,
  type BusinessCode,
  type BusinessName,
} from '@/lib/businesses';
import { ensureAttachmentRoot, storeAttachmentFile } from '@/lib/storage';
import {
  findOrderWithDetails,
  createOrderAttachment,
  createPartAttachment,
  deletePartAttachment,
  findOrderById,
  findPartAttachment,
  findPartById,
  findPartWithOrderInfo,
  listPartAttachments,
  updatePartAttachment,
  updateOrderAttachmentStoragePath,
  updatePartAttachmentStoragePath,
} from '@/repos/orders';
import { OrderAttachmentCreate, PartAttachmentCreate, PartAttachmentUpdate } from './orders.schema';
import { recordPartEvent } from './orders.events.service';

type OrderAttachmentCreateInput = z.infer<typeof OrderAttachmentCreate>;
type PartAttachmentCreateInput = z.infer<typeof PartAttachmentCreate>;
type PartAttachmentUpdateInput = z.infer<typeof PartAttachmentUpdate>;

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

function fail<T>(status: number, error: string | object): ServiceResult<T> {
  return { ok: false, status, error };
}

export async function ensureOrderFilesInCanonicalStorage(orderId: string) {
  const order = await findOrderWithDetails(orderId);
  if (!order) return fail(404, 'Order not found');

  const settings = await getAppSettings();
  const rootDir = settings.attachmentsDir;
  const attachmentRoot = await ensureAttachmentRoot(rootDir);
  const business = businessNameFromCode(order.business as BusinessCode) as BusinessName;
  const customerName = order.customer?.name?.trim() || 'Customer';
  const pathPrefix = [
    slugifyName(business, 'business'),
    slugifyName(customerName, 'customer'),
    slugifyName(order.orderNumber, 'reference'),
  ].join('/');

  const normalizePathPrefix = (value: string) => value.trim().replace(/^\/+/, '');

  const copyToCanonicalPath = async ({
    storagePath,
    label,
  }: {
    storagePath: string;
    label?: string | null;
  }) => {
    const normalizedStorage = normalizePathPrefix(storagePath);
    if (pathPrefix && normalizedStorage.startsWith(`${pathPrefix}/`)) {
      return null;
    }
    const sourcePath = path.join(attachmentRoot, normalizedStorage);
    const buffer = await readFile(sourcePath);
    const stored = await storeAttachmentFile({
      business,
      customerName,
      referenceNumber: order.orderNumber,
      originalFilename: label || path.basename(normalizedStorage),
      buffer,
      rootDir,
    });
    return stored.storagePath;
  };

  for (const attachment of order.attachments ?? []) {
    if (!attachment.storagePath) continue;
    try {
      const nextPath = await copyToCanonicalPath({
        storagePath: attachment.storagePath,
        label: attachment.label,
      });
      if (nextPath) {
        await updateOrderAttachmentStoragePath(attachment.id, nextPath);
      }
    } catch {
      // best effort to keep order creation/conversion resilient
    }
  }

  for (const attachment of order.partAttachments ?? []) {
    if (!attachment.storagePath) continue;
    try {
      const nextPath = await copyToCanonicalPath({
        storagePath: attachment.storagePath,
        label: attachment.label,
      });
      if (nextPath) {
        await updatePartAttachmentStoragePath(attachment.id, nextPath);
      }
    } catch {
      // best effort to keep order creation/conversion resilient
    }
  }

  return ok({ ok: true });
}

export async function createAttachmentForOrder({ orderId, payload, userId }: { orderId: string; payload: OrderAttachmentCreateInput; userId?: string }) {
  const order = await findOrderById(orderId); if (!order) return fail(404, 'Order not found');
  const attachment = await createOrderAttachment({ data: { orderId, url: payload.url ?? null, storagePath: payload.storagePath ?? null, label: payload.label?.length ? payload.label : null, mimeType: payload.mimeType?.length ? payload.mimeType : null, uploadedById: userId ?? null } }); return ok({ attachment });
}
export async function listAttachmentsForPart(partId: string, isAdmin: boolean) { const part = await findPartById(partId); if (!part) return fail(404, 'Part not found'); const storedAttachments = await listPartAttachments(partId); return ok({ attachments: isAdmin ? storedAttachments : storedAttachments.filter(isDrawingPartAttachment) }); }
export async function createAttachmentForPart({ partId, payload, userId }: { partId: string; payload: PartAttachmentCreateInput; userId?: string }) { const part = await findPartWithOrderInfo(partId); if (!part) return fail(404, 'Part not found'); const attachment = await createPartAttachment({ data: { orderId: part.orderId, partId, kind: payload.kind, url: payload.url ?? null, storagePath: payload.storagePath ?? null, label: payload.label ?? null, mimeType: payload.mimeType ?? null } }); if (userId) { const label = attachment.label || attachment.storagePath || attachment.url || 'File'; await recordPartEvent({ orderId: part.orderId, partId, userId, type: 'FILE_UPLOADED', message: `File uploaded: ${label}.`, meta: { attachmentId: attachment.id, kind: attachment.kind } }); } return ok({ attachment }); }
export async function getPartUploadContext(partId: string) { const part = await findPartWithOrderInfo(partId); return part ? ok({ part }) : fail(404, 'Part not found'); }
export async function updateAttachmentForPart({ partId, attachmentId, payload }: { partId: string; attachmentId: string; payload: PartAttachmentUpdateInput }) { const attachment = await findPartAttachment(partId, attachmentId); if (!attachment) return fail(404, 'Attachment not found'); const data: Record<string, unknown> = {}; if (payload.kind !== undefined) data.kind = payload.kind; if (payload.url !== undefined) data.url = payload.url ?? null; if (payload.storagePath !== undefined) data.storagePath = payload.storagePath ?? null; if (payload.label !== undefined) data.label = payload.label ?? null; if (payload.mimeType !== undefined) data.mimeType = payload.mimeType ?? null; return ok({ attachment: await updatePartAttachment(attachmentId, data) }); }
export async function deleteAttachmentForPart(partId: string, attachmentId: string) { const attachment = await findPartAttachment(partId, attachmentId); if (!attachment) return fail(404, 'Attachment not found'); await deletePartAttachment(attachmentId); return ok({ ok: true }); }
