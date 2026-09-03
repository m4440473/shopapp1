import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { BUSINESS_PREFIX_BY_CODE, type BusinessCode } from '@/lib/businesses';
import { hasCustomFieldValue, serializeCustomFieldValue } from '@/lib/custom-field-values';
import { resolveCustomerContactSnapshot } from '@/modules/customers/customers.service';
import { createOrderWithCustomFields, findActiveOrderCustomFields, generateNextOrderNumber, listAddonsByIds, listDepartmentsOrdered } from '@/repos/orders';
import { ensureOrderFilesInCanonicalStorage } from './orders.files.service';
import { OrderCreate } from './orders.schema';

type OrderCreateInput = z.infer<typeof OrderCreate>;
type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string | object };
const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
const fail = <T,>(status: number, error: string | object): ServiceResult<T> => ({ ok: false, status, error });
const optionalId = (value: string | null | undefined) => value?.trim() || null;

export async function createOrderFromPayload(body: OrderCreateInput, userId?: string) {
  const prefix = BUSINESS_PREFIX_BY_CODE[body.business as keyof typeof BUSINESS_PREFIX_BY_CODE] ?? body.business;
  const providedOrderNumber = body.orderNumber?.trim();
  let orderNumber: string;
  if (providedOrderNumber) {
    if (!providedOrderNumber.startsWith(`${prefix}-`)) return fail(400, `Order numbers for ${prefix} must start with ${prefix}-`);
    orderNumber = providedOrderNumber;
  } else orderNumber = await generateNextOrderNumber(body.business as BusinessCode);

  const customFieldValues = body.customFieldValues ?? [];
  const validCustomFieldValues = customFieldValues.length ? await findActiveOrderCustomFields({ fieldIds: customFieldValues.map((value) => value.fieldId), business: body.business as BusinessCode }) : [];
  const allowedFieldIds = new Set(validCustomFieldValues.map((field) => field.id));
  const normalizedCustomFieldValues = customFieldValues
    .filter((value) => allowedFieldIds.has(value.fieldId) && hasCustomFieldValue(value.value))
    .map((value) => ({ fieldId: value.fieldId, value: serializeCustomFieldValue(value.value) }))
    .filter((value) => value.value !== null) as { fieldId: string; value: string }[];
  type AddonRecord = { id: string; name: string; rateCents: number; rateType: string; departmentId: string; affectsPrice: boolean; isChecklistItem: boolean };
  let selectedContact = null;
  try { selectedContact = await resolveCustomerContactSnapshot(body.customerId, body.customerContactId); }
  catch (error) { return fail(400, error instanceof Error ? error.message : 'Invalid customer contact.'); }
  const assignedWorkerIds = Array.from(new Set(body.assignedWorkerIds ?? []));
  const selectedAddonIds = Array.from(new Set([...(body.addonIds ?? []), ...body.parts.flatMap((part) => (part.addonSelections ?? []).map((selection) => selection.addonId))]));
  const selectedAddons = selectedAddonIds.length ? await listAddonsByIds(selectedAddonIds) as AddonRecord[] : [];
  const addonMap = new Map(selectedAddons.map((addon) => [addon.id, addon]));
  const initialDepartmentId = (await listDepartmentsOrdered())[0]?.id ?? null;
  let chargeSortOrder = 0;
  const relatedParts = body.parts.map((part) => {
    const checklistAddonIds = new Set<string>();
    const charges: Array<{ data: Record<string, unknown>; createChecklist: boolean }> = [];
    const checklistItems: Array<Record<string, unknown>> = [];
    for (const selection of part.addonSelections ?? []) {
      const addon = addonMap.get(selection.addonId);
      if (!addon) continue;
      if (addon.affectsPrice) {
        const createChecklist = addon.isChecklistItem && !checklistAddonIds.has(addon.id);
        charges.push({ data: { departmentId: addon.departmentId, addonId: addon.id, kind: 'ADDON', name: addon.name, description: selection.notes ?? null, quantity: new Prisma.Decimal(selection.units ?? 0), unitPrice: new Prisma.Decimal(addon.rateCents ?? 0), sortOrder: chargeSortOrder++ }, createChecklist });
        if (createChecklist) checklistAddonIds.add(addon.id);
      } else if (addon.isChecklistItem && !checklistAddonIds.has(addon.id)) {
        checklistAddonIds.add(addon.id);
        checklistItems.push({ addonId: addon.id, departmentId: addon.departmentId ?? null });
      }
    }
    for (const addonId of body.addonIds ?? []) {
      const addon = addonMap.get(addonId);
      if (!addon?.isChecklistItem || addon.affectsPrice || checklistAddonIds.has(addon.id)) continue;
      checklistAddonIds.add(addon.id);
      checklistItems.push({ addonId: addon.id, departmentId: addon.departmentId ?? null });
    }
    return { attachments: (part.attachments ?? []).map((attachment) => ({ kind: attachment.kind, url: attachment.url ?? null, storagePath: attachment.storagePath ?? null, label: attachment.label ?? null, mimeType: attachment.mimeType ?? null })), charges, checklistItems };
  });
  const created = await createOrderWithCustomFields({
    orderData: {
      data: {
        orderNumber, business: body.business, customerId: body.customerId,
        customerContactId: selectedContact?.customerContactId ?? null,
        contactName: selectedContact?.contactName ?? body.contactName ?? null,
        contactEmail: selectedContact?.contactEmail ?? body.contactEmail ?? null,
        contactPhone: selectedContact?.contactPhone ?? body.contactPhone ?? null,
        modelIncluded: body.modelIncluded, receivedDate: new Date(body.receivedDate), dueDate: new Date(body.dueDate), priority: body.priority, status: 'RECEIVED', materialNeeded: body.materialNeeded, materialOrdered: body.materialOrdered,
        vendorId: body.vendorId ?? null, poNumber: body.poNumber ?? null, assignedMachinistId: body.assignedMachinistId ?? null,
        parts: { create: body.parts.map((part) => ({ partNumber: part.partNumber, partName: part.partName ?? null, quantity: part.quantity, materialId: optionalId(part.materialId), drawingMaterialText: part.drawingMaterialText ?? null, drawingFinishText: part.drawingFinishText ?? null, finish: part.finish ?? null, materialStatus: part.materialStatus ?? 'UNREVIEWED', inventoryLocation: part.inventoryLocation ?? null, materialNotes: part.materialNotes ?? null, procurementVendorId: optionalId(part.procurementVendorId), stockSize: part.stockSize ?? null, cutLength: part.cutLength ?? null, finalPartLength: part.finalPartLength ?? null, partWidth: part.partWidth ?? null, partThickness: part.partThickness ?? null, notes: part.notes ?? null, workInstructions: part.workInstructions ?? null, assignments: assignedWorkerIds.length ? { create: assignedWorkerIds.map((assignedUserId) => ({ userId: assignedUserId, assignedById: userId ?? null, assignmentType: 'WORKER', isActive: true })) } : undefined })) },
        attachments: body.attachments.length ? { create: body.attachments.map((attachment) => ({ url: attachment.url ?? null, storagePath: attachment.storagePath ?? null, label: attachment.label ?? null, mimeType: attachment.mimeType ?? null, uploadedById: userId ?? null })) } : undefined,
        notes: body.notes && userId ? { create: { content: body.notes, userId } } : undefined,
        statusHistory: { create: { from: 'RECEIVED', to: 'RECEIVED', userId, reason: 'Order created' } },
      },
      select: { id: true, parts: { select: { id: true }, orderBy: { createdAt: 'asc' } } },
    },
    customFieldValues: normalizedCustomFieldValues,
    relatedData: { parts: relatedParts, initialDepartmentId },
  });
  const warnings: string[] = [];
  try { await ensureOrderFilesInCanonicalStorage(created.id); }
  catch (error) {
    console.error('Order created but file finalization failed', { orderId: created.id, error });
    warnings.push('Order was created, but one or more files could not be moved into final storage.');
  }
  return ok({ id: created.id, parts: created.parts ?? [], warnings });
}
